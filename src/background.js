// Context Vocab — service worker
// Handles all external API calls (DeepSeek + Eudic OpenAPI) and storage writes.

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const EUDIC_ADD_URL = "https://api.frdic.com/api/open/v1/studylist/words";
const EUDIC_ADD_URL_FALLBACK = "https://my.eudic.net/OpenAPI/StudyList/AddWords";

const SYSTEM_PROMPT =
  "You are a vocabulary assistant for advanced English learners. " +
  "Given a selected word/phrase and its surrounding context, explain the word as it is used in that specific passage. " +
  "Always respond with valid JSON only, no markdown fences.";

// ---------- Storage helpers ----------

async function getSettings() {
  const { deepseek_key, eudic_token } = await chrome.storage.local.get([
    "deepseek_key",
    "eudic_token"
  ]);
  return { deepseek_key, eudic_token };
}

async function appendWordLog(entry) {
  const { word_log } = await chrome.storage.local.get("word_log");
  const log = Array.isArray(word_log) ? word_log : [];
  log.unshift(entry);
  // Cap log to 1000 entries to prevent runaway growth.
  if (log.length > 1000) log.length = 1000;
  await chrome.storage.local.set({ word_log: log });

  const { session_count } = await chrome.storage.session?.get?.("session_count") ?? {};
  // session storage may not exist; track in local as a soft counter for the popup.
  const { saves_total } = await chrome.storage.local.get("saves_total");
  await chrome.storage.local.set({ saves_total: (saves_total || 0) + 1 });
}

// ---------- JSON parsing ----------

function parseModelJson(raw) {
  if (!raw) return { meaning: "" };
  let s = String(raw).trim();

  // Replace smart quotes
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(s);
  } catch (_) {
    // Fallback: extract first {...} block
    const match = s.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_e) {
        // fall through
      }
    }
  }
  return { meaning: raw };
}

// ---------- DeepSeek ----------

async function callDeepSeek({ word, context, url }) {
  const { deepseek_key } = await getSettings();
  if (!deepseek_key) {
    return { ok: false, code: "NO_KEY", error: "DeepSeek API key not set. Open Settings to configure it." };
  }

  const userMessage =
    `Word: ${word}\n` +
    `Context passage: ${context}\n` +
    `Source: ${url}\n\n` +
    "Respond with this exact JSON:\n" +
    "{\n" +
    '  "meaning": "concise definition",\n' +
    '  "in_context": "why it means this here, referencing the passage",\n' +
    '  "type": "part of speech or category",\n' +
    '  "note": "one memorable detail, etymology, or usage tip"\n' +
    "}";

  let res;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseek_key}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ]
      })
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return { ok: false, error: "Empty response from DeepSeek." };

  const parsed = parseModelJson(raw);
  return { ok: true, parsed, raw };
}

// ---------- Eudic OpenAPI ----------

async function eudicAddWord(token, word) {
  const body = JSON.stringify({
    id: "0",
    language: "en",
    words: [word]
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // Try newer endpoint first; fall back to legacy if it 404s.
  for (const url of [EUDIC_ADD_URL_FALLBACK, EUDIC_ADD_URL]) {
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.ok) return { ok: true };
      if (res.status === 401 || res.status === 403) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Eudic auth failed (${res.status}): ${text.slice(0, 160)}` };
      }
      // Other status: try next url
    } catch (err) {
      // Network error: try next
    }
  }
  return { ok: false, error: "Eudic API request failed." };
}

async function saveWord(payload) {
  const { eudic_token } = await getSettings();
  if (!eudic_token) {
    return { ok: false, code: "NO_TOKEN", error: "Eudic token not set." };
  }

  const result = await eudicAddWord(eudic_token, payload.word);
  if (!result.ok) return result;

  await appendWordLog({
    word: payload.word,
    meaning: payload.meaning,
    in_context: payload.in_context,
    type: payload.type,
    note: payload.note,
    context: payload.context,
    source_url: payload.source_url,
    source_title: payload.source_title,
    saved_at: payload.saved_at
  });

  return { ok: true };
}

// ---------- Message router ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "LOOKUP") {
        const result = await callDeepSeek(msg.payload);
        sendResponse(result);
      } else if (msg?.type === "SAVE_WORD") {
        const result = await saveWord(msg.payload);
        sendResponse(result);
      } else if (msg?.type === "GET_STATUS") {
        const { deepseek_key, eudic_token } = await getSettings();
        const { saves_total } = await chrome.storage.local.get("saves_total");
        sendResponse({
          ok: true,
          deepseek_configured: !!deepseek_key,
          eudic_configured: !!eudic_token,
          saves_total: saves_total || 0
        });
      } else {
        sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || "Unhandled error" });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});

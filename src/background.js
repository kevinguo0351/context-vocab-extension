// Context Vocab — service worker
// Handles all external API calls (DeepSeek + Eudic OpenAPI) and storage writes.

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const EUDIC_BASE = "https://api.frdic.com/api/open/v1";
const EUDIC_NOTE_MAX = 900; // keep context_line well below any plausible cap

const SYSTEM_PROMPT =
  "你是一个为中国英语学习者服务的词汇解释助手。" +
  "用户会给你一个在网页中选中的英文单词或短语，以及它前后约 300 字的英文上下文。" +
  "请用简体中文解释这个词在该具体语境中的含义——不要给字典式的多义词列表，而是基于上下文判断它在此处真正指什么。" +
  "尤其注意缩写、专有名词、俚语、双关、比喻用法。" +
  "回复必须是合法的 JSON，不要包含 markdown 代码块、不要任何额外文字。所有字段值都用简体中文。";

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
  if (log.length > 1000) log.length = 1000;
  await chrome.storage.local.set({ word_log: log });

  const { saves_total } = await chrome.storage.local.get("saves_total");
  await chrome.storage.local.set({ saves_total: (saves_total || 0) + 1 });
}

// ---------- JSON parsing ----------

function parseModelJson(raw) {
  if (!raw) return { meaning: "" };
  let s = String(raw).trim();
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(s); } catch (_) {}
  const match = s.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return { meaning: raw };
}

// ---------- DeepSeek ----------

async function callDeepSeek({ word, context, url }) {
  const { deepseek_key } = await getSettings();
  if (!deepseek_key) {
    return { ok: false, code: "NO_KEY", error: "未设置 DeepSeek API key，请先在设置中填写。" };
  }

  const userMessage =
    `选中的词/短语: ${word}\n` +
    `上下文段落: ${context}\n` +
    `来源: ${url}\n\n` +
    "请按以下 JSON 格式回复：\n" +
    "{\n" +
    '  "meaning": "在该语境下的中文释义（1-2 句即可）",\n' +
    '  "in_context": "结合上下文解释，为什么在这段中是这个意思",\n' +
    '  "type": "词性或类别（中文，例如 名词、动词、专有名词-高速公路名）",\n' +
    '  "note": "一个有用的小知识、记忆点、词源或地道用法提示"\n' +
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
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ]
      })
    });
  } catch (err) {
    return { ok: false, error: `网络错误: ${err.message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return { ok: false, error: "DeepSeek 返回为空。" };

  return { ok: true, parsed: parseModelJson(raw), raw };
}

// ---------- Eudic OpenAPI ----------
// Auth: raw token (NO "Bearer" prefix). Some accounts need "NIS <token>".
// Endpoint for word + note: POST /studylist/word (singular) with `context_line`.

function buildContextLine(payload) {
  const parts = [];
  if (payload.in_context) parts.push(`【此处含义】${payload.in_context}`);
  if (payload.meaning && payload.meaning !== payload.in_context) {
    parts.push(`【释义】${payload.meaning}`);
  }
  if (payload.type) parts.push(`【词性】${payload.type}`);
  if (payload.note) parts.push(`【备注】${payload.note}`);
  if (payload.context) parts.push(`【原文】${payload.context}`);
  if (payload.source_title || payload.source_url) {
    parts.push(`【来源】${payload.source_title || ""} ${payload.source_url || ""}`.trim());
  }
  let text = parts.join("\n");
  if (text.length > EUDIC_NOTE_MAX) text = text.slice(0, EUDIC_NOTE_MAX - 1) + "…";
  return text;
}

async function eudicAddSingleWord(token, word, contextLine) {
  const body = JSON.stringify({
    language: "en",
    word,
    context_line: contextLine,
    category_ids: [0]
  });

  // Try raw token first; if 401, retry with "NIS " prefix that some Eudic accounts require.
  const headerVariants = [token, `NIS ${token}`];
  let lastError = "";
  for (const auth of headerVariants) {
    try {
      const res = await fetch(`${EUDIC_BASE}/studylist/word`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json"
        },
        body
      });
      if (res.ok) return { ok: true };
      const text = await res.text().catch(() => "");
      lastError = `Eudic ${res.status}: ${text.slice(0, 200)}`;
      // Only retry on 401/403 (auth-related). Other errors: bail.
      if (res.status !== 401 && res.status !== 403) break;
    } catch (err) {
      lastError = `网络错误: ${err.message}`;
    }
  }
  return { ok: false, error: lastError || "Eudic 请求失败。" };
}

// Fallback for accounts where /studylist/word (singular) isn't supported:
// add the bare word via the batch endpoint. Note: this loses the context_line.
async function eudicAddWordBatch(token, word) {
  const body = JSON.stringify({
    language: "en",
    category_id: "0",
    words: [word]
  });
  const headerVariants = [token, `NIS ${token}`];
  for (const auth of headerVariants) {
    try {
      const res = await fetch(`${EUDIC_BASE}/studylist/words`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body
      });
      if (res.ok) return { ok: true, fallback: true };
      if (res.status !== 401 && res.status !== 403) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Eudic ${res.status}: ${text.slice(0, 200)}` };
      }
    } catch (err) {
      return { ok: false, error: `网络错误: ${err.message}` };
    }
  }
  return { ok: false, error: "Eudic 鉴权失败（401）。请检查 token 是否正确。" };
}

async function saveWord(payload) {
  const { eudic_token } = await getSettings();
  if (!eudic_token) {
    return { ok: false, code: "NO_TOKEN", error: "未设置欧陆 token。" };
  }

  const contextLine = buildContextLine(payload);

  // Primary: singular endpoint with context_line (the note).
  let result = await eudicAddSingleWord(eudic_token, payload.word, contextLine);

  // Fallback: if singular endpoint not supported (404) or another non-auth error,
  // at least save the word itself.
  if (!result.ok && /Eudic 404/.test(result.error || "")) {
    result = await eudicAddWordBatch(eudic_token, payload.word);
  }

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

  return { ok: true, fallback: !!result.fallback };
}

// ---------- Message router ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "LOOKUP") {
        sendResponse(await callDeepSeek(msg.payload));
      } else if (msg?.type === "SAVE_WORD") {
        sendResponse(await saveWord(msg.payload));
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
        sendResponse({ ok: false, error: "未知消息类型" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || "未处理的错误" });
    }
  })();
  return true; // async sendResponse
});

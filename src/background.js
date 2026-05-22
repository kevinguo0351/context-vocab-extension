// Context Vocab — service worker
// Handles all external API calls (DeepSeek + Eudic OpenAPI) and storage writes.

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const EUDIC_BASE = "https://api.frdic.com/api/open/v1";
const EUDIC_NOTE_MAX = 900; // keep note text well below any plausible cap

const SYSTEM_PROMPT =
  "你是一个为中国英语学习者服务的词汇解释助手。" +
  "用户会给你一个在网页中选中的英文单词或短语，以及它前后约 300 字的英文上下文。" +
  "请按以下原则输出：\n" +
  "- meaning：这个词的**通用字典式释义**，简短、精炼，10–30 字以内，相当于词典首条解释。如果是多义词，给出与本语境最匹配的那条主释义即可，不要罗列。\n" +
  "- in_context：**结合上下文**展开解释——为什么在这一段里就是这个意思，引用上下文里的关键词，2–3 句话。这是和字典释义最大的区别。\n" +
  "- type：词性或类别，例如「名词」「专有名词 · 高速公路名」「短语动词」。\n" +
  "- note：一个对记忆有帮助的小知识——词源、构词法、易混词、地道用法、文化背景等，1 句话。\n" +
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
    "请按以下 JSON 格式回复（字段顺序与含义见 system 指令）：\n" +
    "{\n" +
    '  "meaning": "字典式简短释义，10–30 字",\n' +
    '  "in_context": "结合本段上下文展开解释，2–3 句",\n' +
    '  "type": "词性或类别",\n' +
    '  "note": "1 句记忆点 / 词源 / 地道用法"\n' +
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
// Two-step save:
//   1) POST /studylist/word   { language, word, category_ids: [0] }
//   2) POST /studylist/note   { language, word, note }
// Verified against multiple production clients (saladict, STranslate, LuLuDictOperator,
// llm-vocabulary-reminder, paw, lingo-link). The `note` field is what shows as the
// per-word "释义/笔记" inside the Eudic mobile app.

function buildNoteText(payload) {
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

// Try the call with raw token first; on 401/403 retry with "NIS <token>" (some
// older Eudic accounts copy the token with a "NIS " prefix from the dashboard).
async function eudicFetch(token, path, body) {
  const headerVariants = [token, `NIS ${token}`];
  let lastError = "";
  for (const auth of headerVariants) {
    try {
      const res = await fetch(`${EUDIC_BASE}${path}`, {
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
      if (res.status !== 401 && res.status !== 403) break;
    } catch (err) {
      lastError = `网络错误: ${err.message}`;
    }
  }
  return { ok: false, error: lastError || "Eudic 请求失败。" };
}

async function saveWord(payload) {
  const { eudic_token } = await getSettings();
  if (!eudic_token) {
    return { ok: false, code: "NO_TOKEN", error: "未设置欧陆 token。" };
  }

  // Step 1: add the word to the default 生词本.
  const wordBody = JSON.stringify({
    language: "en",
    word: payload.word,
    category_ids: [0]
  });
  const addResult = await eudicFetch(eudic_token, "/studylist/word", wordBody);
  if (!addResult.ok) return addResult;

  // Step 2: attach the note. Failure here is non-fatal — the word is in;
  // we just report the partial-success so the user can retry the note later.
  const noteText = buildNoteText(payload);
  let noteWarning = null;
  if (noteText) {
    const noteBody = JSON.stringify({
      language: "en",
      word: payload.word,
      note: noteText
    });
    const noteResult = await eudicFetch(eudic_token, "/studylist/note", noteBody);
    if (!noteResult.ok) {
      noteWarning = `单词已存入，但笔记写入失败：${noteResult.error}`;
    }
  }

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

  return { ok: true, warning: noteWarning };
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

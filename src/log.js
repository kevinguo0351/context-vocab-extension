const $list = document.getElementById("list");
const $count = document.getElementById("count");
const $search = document.getElementById("search");
const $exportJson = document.getElementById("export-json");
const $exportCsv = document.getElementById("export-csv");
const $exportAnki = document.getElementById("export-anki");
const $clear = document.getElementById("clear");

let allEntries = [];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function render(entries) {
  if (!entries.length) {
    $list.innerHTML = `<div class="empty">还没有存过词。在任意网页选中一个词，点 ✦ 查词 即可。</div>`;
    return;
  }
  $list.innerHTML = entries.map(e => `
    <div class="entry">
      <div class="top">
        <div class="word">${escapeHtml(e.word)}</div>
        <div class="when">${escapeHtml(formatDate(e.saved_at))}</div>
      </div>
      ${e.meaning ? `<div class="meaning">${escapeHtml(e.meaning)}</div>` : ""}
      ${e.in_context ? `<div class="label">此处含义</div><div class="meaning">${escapeHtml(e.in_context)}</div>` : ""}
      ${e.context ? `<div class="label">原文</div><div class="ctx">${escapeHtml(e.context)}</div>` : ""}
      ${e.source_url ? `<div class="src"><a href="${escapeHtml(e.source_url)}" target="_blank" rel="noopener">${escapeHtml(e.source_title || e.source_url)}</a></div>` : ""}
    </div>
  `).join("");
}

function applyFilter() {
  const q = $search.value.trim().toLowerCase();
  if (!q) { render(allEntries); return; }
  const filtered = allEntries.filter(e =>
    (e.word || "").toLowerCase().includes(q) ||
    (e.meaning || "").toLowerCase().includes(q) ||
    (e.context || "").toLowerCase().includes(q) ||
    (e.source_title || "").toLowerCase().includes(q) ||
    (e.source_url || "").toLowerCase().includes(q)
  );
  render(filtered);
}

async function load() {
  const { word_log } = await chrome.storage.local.get("word_log");
  allEntries = Array.isArray(word_log) ? word_log : [];
  $count.textContent = `共 ${allEntries.length} 条`;
  render(allEntries);
}

// ---------- Download helpers ----------

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function ensureNonEmpty() {
  if (!allEntries.length) {
    alert("档案为空，先存几个词再来导出吧。");
    return false;
  }
  return true;
}

// ---------- JSON ----------

$exportJson.addEventListener("click", () => {
  if (!ensureNonEmpty()) return;
  const blob = new Blob([JSON.stringify(allEntries, null, 2)], {
    type: "application/json"
  });
  downloadBlob(blob, `context-vocab-${todayStamp()}.json`);
});

// ---------- CSV (RFC 4180) ----------
// Columns are explicit so importers can map to wordlist apps cleanly.
// Word and definition are kept in separate columns by design.

const CSV_COLUMNS = [
  ["word",         "单词"],
  ["meaning",      "释义"],
  ["in_context",   "此处含义"],
  ["type",         "词性"],
  ["note",         "备注"],
  ["context",      "原文"],
  ["source_title", "来源标题"],
  ["source_url",   "来源链接"],
  ["saved_at",     "保存时间"]
];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Normalize line breaks; CSV consumers handle \r\n inside quoted fields.
  s = s.replace(/\r\n/g, "\n");
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsv(entries) {
  const header = CSV_COLUMNS.map(c => csvEscape(c[1])).join(",");
  const rows = entries.map(e =>
    CSV_COLUMNS.map(c => csvEscape(e[c[0]])).join(",")
  );
  // UTF-8 BOM so Excel on Windows opens it as UTF-8 by default.
  return "﻿" + [header, ...rows].join("\r\n");
}

$exportCsv.addEventListener("click", () => {
  if (!ensureNonEmpty()) return;
  const csv = buildCsv(allEntries);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `context-vocab-${todayStamp()}.csv`);
});

// ---------- Anki TSV ----------
// Three tab-separated columns optimized for Anki's import:
//   1. Front  — the word
//   2. Back   — HTML-formatted: meaning, in-context, original passage, source link
//   3. Tags   — space-separated; Anki splits on spaces by default
// Newlines inside fields are encoded as <br> so each card stays on one line.

function htmlEscapeForAnki(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}

function buildAnkiBack(e) {
  const parts = [];
  if (e.meaning)    parts.push(`<div><b>释义</b> ${htmlEscapeForAnki(e.meaning)}</div>`);
  if (e.type)       parts.push(`<div style="color:#888;font-size:0.9em">${htmlEscapeForAnki(e.type)}</div>`);
  if (e.in_context) parts.push(`<div style="margin-top:8px"><b>此处含义</b><br>${htmlEscapeForAnki(e.in_context)}</div>`);
  if (e.context) {
    // Highlight the word inside the passage, if found, to make example sentences pop.
    const safe = htmlEscapeForAnki(e.context);
    const w = htmlEscapeForAnki(e.word || "");
    const highlighted = w
      ? safe.replace(new RegExp(escapeRegex(w), "gi"), m => `<b>${m}</b>`)
      : safe;
    parts.push(`<div style="margin-top:8px;color:#666;font-style:italic">${highlighted}</div>`);
  }
  if (e.note) parts.push(`<div style="margin-top:8px;font-size:0.9em">💡 ${htmlEscapeForAnki(e.note)}</div>`);
  if (e.source_url) {
    const title = htmlEscapeForAnki(e.source_title || e.source_url);
    parts.push(`<div style="margin-top:8px;font-size:0.85em"><a href="${htmlEscapeForAnki(e.source_url)}">${title}</a></div>`);
  }
  return parts.join("");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ankiTsvField(s) {
  // Tabs and bare newlines would split the row; encode them safely.
  return String(s ?? "").replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
}

function buildAnkiTsv(entries) {
  // Anki recognizes "#" header lines as metadata. Declaring the format up front
  // makes import smoother in modern Anki versions and harmless in older ones.
  const header = [
    "#separator:tab",
    "#html:true",
    "#columns:Word\tBack\tTags",
    "#tags column:3"
  ].join("\n");
  const rows = entries.map(e => [
    ankiTsvField(e.word),
    ankiTsvField(buildAnkiBack(e)),
    "context-vocab"
  ].join("\t"));
  return header + "\n" + rows.join("\n") + "\n";
}

$exportAnki.addEventListener("click", () => {
  if (!ensureNonEmpty()) return;
  const tsv = buildAnkiTsv(allEntries);
  const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
  downloadBlob(blob, `context-vocab-anki-${todayStamp()}.txt`);
  setTimeout(() => {
    alert(
      "Anki 导入步骤：\n" +
      "1. 打开 Anki → 文件 → 导入\n" +
      "2. 选择刚下载的 .txt 文件\n" +
      "3. 笔记类型选「Basic」或自定义两字段类型\n" +
      "4. 字段映射：第 1 列 → Front，第 2 列 → Back，第 3 列 → Tags\n" +
      "5. 勾选「Allow HTML in fields」\n" +
      "现代版本的 Anki 会自动识别文件头里的设置。"
    );
  }, 200);
});

$search.addEventListener("input", applyFilter);

$clear.addEventListener("click", async () => {
  if (!confirm("确定清空整个语境档案？此操作不可恢复。")) return;
  await chrome.storage.local.remove("word_log");
  await load();
});

load();

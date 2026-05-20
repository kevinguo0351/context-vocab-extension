const $list = document.getElementById("list");
const $count = document.getElementById("count");
const $search = document.getElementById("search");
const $export = document.getElementById("export");
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
    $list.innerHTML = `<div class="empty">No saved words yet. Select a word on any webpage and click ✦ Look up.</div>`;
    return;
  }
  $list.innerHTML = entries.map(e => `
    <div class="entry">
      <div class="top">
        <div class="word">${escapeHtml(e.word)}</div>
        <div class="when">${escapeHtml(formatDate(e.saved_at))}</div>
      </div>
      ${e.meaning ? `<div class="meaning">${escapeHtml(e.meaning)}</div>` : ""}
      ${e.in_context ? `<div class="label">IN THIS CONTEXT</div><div class="meaning">${escapeHtml(e.in_context)}</div>` : ""}
      ${e.context ? `<div class="label">PASSAGE</div><div class="ctx">${escapeHtml(e.context)}</div>` : ""}
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
  $count.textContent = `${allEntries.length} ${allEntries.length === 1 ? "entry" : "entries"}`;
  render(allEntries);
}

$search.addEventListener("input", applyFilter);

$export.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(allEntries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `context-vocab-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$clear.addEventListener("click", async () => {
  if (!confirm("Clear the entire word log? This cannot be undone.")) return;
  await chrome.storage.local.remove("word_log");
  await load();
});

load();

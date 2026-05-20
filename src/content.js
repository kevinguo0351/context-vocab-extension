// Context Vocab — content script
// Selection detection, floating action button, lookup panel.

(() => {
  const MAX_SELECTION_LEN = 60;
  const CONTEXT_BEFORE = 300; // chars before the selection
  const CONTEXT_AFTER = 300;  // chars after the selection
  const BUTTON_ID = "ctxvocab-fab";
  const PANEL_ID = "ctxvocab-panel";

  // ---------- Selection capture ----------

  function getBlockAncestor(node) {
    const blockTags = new Set([
      "P", "DIV", "LI", "TD", "BLOCKQUOTE", "ARTICLE",
      "SECTION", "PRE", "DD", "DT", "FIGCAPTION", "MAIN", "ASIDE"
    ]);
    let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName)) return el;
      el = el.parentElement;
    }
    return document.body;
  }

  // Walk up ancestors collecting text until we have enough context on both sides.
  function captureContext(selection, selectedText) {
    if (!selection.rangeCount) return selectedText;
    const range = selection.getRangeAt(0);
    let block = getBlockAncestor(range.commonAncestorContainer);

    let blockText = (block.textContent || "").replace(/\s+/g, " ").trim();
    let idx = blockText.indexOf(selectedText);

    // If the block doesn't have enough surrounding text, climb to a larger ancestor.
    let safety = 4;
    while (
      block && block !== document.body && safety-- > 0 &&
      (idx === -1 ||
        idx < CONTEXT_BEFORE * 0.6 ||
        blockText.length - idx - selectedText.length < CONTEXT_AFTER * 0.6) &&
      blockText.length < (CONTEXT_BEFORE + CONTEXT_AFTER + selectedText.length + 200)
    ) {
      block = block.parentElement;
      if (!block) break;
      blockText = (block.textContent || "").replace(/\s+/g, " ").trim();
      idx = blockText.indexOf(selectedText);
    }

    if (idx === -1) {
      return blockText.slice(0, CONTEXT_BEFORE + CONTEXT_AFTER);
    }

    const start = Math.max(0, idx - CONTEXT_BEFORE);
    const end = Math.min(blockText.length, idx + selectedText.length + CONTEXT_AFTER);
    let snippet = blockText.slice(start, end);
    if (start > 0) snippet = "…" + snippet;
    if (end < blockText.length) snippet = snippet + "…";
    return snippet;
  }

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const text = sel.toString().trim();
    if (!text || text.length > MAX_SELECTION_LEN) return null;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;

    return {
      word: text,
      context: captureContext(sel, text),
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    };
  }

  // ---------- Floating action button ----------

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
  }

  function showButton(data) {
    removeButton();
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "ctxvocab-fab";
    btn.textContent = "✦ 查词";
    btn.type = "button";

    const top = data.rect.top + window.scrollY - 36;
    const left = data.rect.left + window.scrollX + (data.rect.width / 2) - 36;
    btn.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    btn.style.left = `${Math.max(4, left)}px`;

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeButton();
      openPanel(data);
    });

    document.body.appendChild(btn);
  }

  // ---------- Dictionary URL builders ----------

  function ldoceUrl(word) {
    const slug = word.toLowerCase().trim().replace(/\s+/g, "-");
    return `https://www.ldoceonline.com/dictionary/${encodeURIComponent(slug)}`;
  }
  function mwUrl(word) {
    return `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.trim())}`;
  }
  function cambridgeUrl(word) {
    const slug = word.toLowerCase().trim().replace(/\s+/g, "-");
    return `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encodeURIComponent(slug)}`;
  }

  // ---------- Panel ----------

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
  }

  function buildPanelShell(data) {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "ctxvocab-panel";

    const PANEL_W = 340;
    const margin = 12;
    let left = data.rect.right + window.scrollX + margin;
    if (left + PANEL_W > window.scrollX + window.innerWidth - margin) {
      left = data.rect.left + window.scrollX - PANEL_W - margin;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;

    let top = data.rect.top + window.scrollY;
    if (top + 280 > window.scrollY + window.innerHeight - margin) {
      top = window.scrollY + window.innerHeight - 280 - margin;
    }
    if (top < window.scrollY + margin) top = window.scrollY + margin;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;

    panel.innerHTML = `
      <div class="ctxvocab-header">
        <div class="ctxvocab-word" title="${escapeHtml(data.word)}">${escapeHtml(data.word)}</div>
        <button class="ctxvocab-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="ctxvocab-body">
        <div class="ctxvocab-loading">分析语境中…</div>
      </div>
      <div class="ctxvocab-dicts" hidden>
        <div class="ctxvocab-dicts-label">查阅外部词典</div>
        <div class="ctxvocab-dicts-row">
          <a class="ctxvocab-link" data-dict="ldoce" target="_blank" rel="noopener">朗文</a>
          <a class="ctxvocab-link" data-dict="mw" target="_blank" rel="noopener">韦氏</a>
          <a class="ctxvocab-link" data-dict="cambridge" target="_blank" rel="noopener">剑桥</a>
        </div>
      </div>
      <div class="ctxvocab-actions" hidden>
        <button class="ctxvocab-btn ctxvocab-save" type="button">＋ 存到欧陆（带语境）</button>
      </div>
      <div class="ctxvocab-status" hidden></div>
    `;

    panel.querySelector(".ctxvocab-close").addEventListener("click", removePanel);
    panel.addEventListener("mousedown", (e) => e.stopPropagation());

    return panel;
  }

  function wireDictLinks(panel, word) {
    const ldoce = panel.querySelector('[data-dict="ldoce"]');
    const mw = panel.querySelector('[data-dict="mw"]');
    const cam = panel.querySelector('[data-dict="cambridge"]');
    if (ldoce) ldoce.href = ldoceUrl(word);
    if (mw) mw.href = mwUrl(word);
    if (cam) cam.href = cambridgeUrl(word);
    panel.querySelector(".ctxvocab-dicts").hidden = false;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderResult(panel, data, parsed) {
    const body = panel.querySelector(".ctxvocab-body");
    const meaning = parsed.meaning || "（未返回释义）";
    const inContext = parsed.in_context || "";
    const type = parsed.type || "";
    const note = parsed.note || "";

    body.innerHTML = `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">释义</div>
        <div class="ctxvocab-text">${escapeHtml(meaning)}</div>
      </div>
      ${inContext ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">此处含义</div>
        <div class="ctxvocab-text">${escapeHtml(inContext)}</div>
      </div>` : ""}
      ${type ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">词性</div>
        <div class="ctxvocab-text">${escapeHtml(type)}</div>
      </div>` : ""}
      ${note ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">备注</div>
        <div class="ctxvocab-text">${escapeHtml(note)}</div>
      </div>` : ""}
    `;

    wireDictLinks(panel, data.word);

    const actions = panel.querySelector(".ctxvocab-actions");
    actions.hidden = false;

    const saveBtn = panel.querySelector(".ctxvocab-save");
    saveBtn.addEventListener("click", () => saveToWordlist(panel, data, {
      meaning, in_context: inContext, type, note
    }));
  }

  function setStatus(panel, msg, kind) {
    const el = panel.querySelector(".ctxvocab-status");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
    el.className = "ctxvocab-status" + (kind ? ` ctxvocab-status-${kind}` : "");
  }

  function renderError(panel, msg) {
    const body = panel.querySelector(".ctxvocab-body");
    body.innerHTML = `<div class="ctxvocab-error">${escapeHtml(msg)}</div>`;
    // Even on error, expose dictionary links so the user isn't stuck.
    wireDictLinks(panel, panel.querySelector(".ctxvocab-word")?.textContent || "");
  }

  async function openPanel(data) {
    removePanel();
    const panel = buildPanelShell(data);
    document.body.appendChild(panel);

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "LOOKUP",
        payload: { word: data.word, context: data.context, url: data.url }
      });
      if (!resp || !resp.ok) {
        renderError(panel, resp?.error || "查询失败。");
        return;
      }
      renderResult(panel, data, resp.parsed);
    } catch (err) {
      renderError(panel, err?.message || "查询失败。");
    }
  }

  async function saveToWordlist(panel, data, parsed) {
    const btn = panel.querySelector(".ctxvocab-save");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "保存中…";
    setStatus(panel, "", null);

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "SAVE_WORD",
        payload: {
          word: data.word,
          meaning: parsed.meaning,
          in_context: parsed.in_context,
          type: parsed.type,
          note: parsed.note,
          context: data.context,
          source_url: data.url,
          source_title: data.title,
          saved_at: new Date().toISOString()
        }
      });
      if (resp?.ok) {
        btn.textContent = "✓ 已存入欧陆";
        btn.classList.add("ctxvocab-saved");
      } else if (resp?.code === "NO_TOKEN") {
        btn.textContent = "⚠ 请在设置里填欧陆 token";
        btn.disabled = false;
      } else {
        btn.textContent = original;
        btn.disabled = false;
        setStatus(panel, resp?.error || "保存失败。", "error");
      }
    } catch (err) {
      btn.textContent = original;
      btn.disabled = false;
      setStatus(panel, err?.message || "保存失败。", "error");
    }
  }

  // ---------- Event wiring ----------

  document.addEventListener("mouseup", (e) => {
    if (e.target && e.target.closest && e.target.closest(`#${BUTTON_ID}, #${PANEL_ID}`)) {
      return;
    }
    setTimeout(() => {
      const data = captureSelection();
      if (!data) {
        removeButton();
        return;
      }
      showButton(data);
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target && e.target.closest && e.target.closest(`#${BUTTON_ID}, #${PANEL_ID}`)) {
      return;
    }
    removeButton();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removeButton();
      removePanel();
    }
  });

  window.addEventListener("scroll", removeButton, { passive: true });
  window.addEventListener("resize", removeButton, { passive: true });
})();

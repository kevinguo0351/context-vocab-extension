// Context Vocab — content script
// Handles selection detection, floating action button, and lookup panel.

(() => {
  const MAX_SELECTION_LEN = 60;
  const CONTEXT_WINDOW = 400;
  const BUTTON_ID = "ctxvocab-fab";
  const PANEL_ID = "ctxvocab-panel";

  let currentSelectionData = null;

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

  function captureContext(selection, selectedText) {
    if (!selection.rangeCount) return selectedText;
    const range = selection.getRangeAt(0);
    const block = getBlockAncestor(range.commonAncestorContainer);
    const blockText = (block.textContent || "").replace(/\s+/g, " ").trim();
    if (blockText.length <= CONTEXT_WINDOW) return blockText;

    const idx = blockText.indexOf(selectedText);
    if (idx === -1) return blockText.slice(0, CONTEXT_WINDOW);

    const half = Math.floor(CONTEXT_WINDOW / 2);
    let start = Math.max(0, idx - half);
    let end = Math.min(blockText.length, start + CONTEXT_WINDOW);
    start = Math.max(0, end - CONTEXT_WINDOW);
    return blockText.slice(start, end);
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
    btn.textContent = "✦ Look up";
    btn.type = "button";

    // Position absolutely against document
    const top = data.rect.top + window.scrollY - 36;
    const left = data.rect.left + window.scrollX + (data.rect.width / 2) - 50;
    btn.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    btn.style.left = `${Math.max(4, left)}px`;

    btn.addEventListener("mousedown", (e) => {
      // Prevent the click from clearing the selection before we capture it.
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

  // ---------- Panel ----------

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
  }

  function buildPanelShell(data) {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "ctxvocab-panel";

    const PANEL_W = 320;
    const margin = 12;
    let left = data.rect.right + window.scrollX + margin;
    if (left + PANEL_W > window.scrollX + window.innerWidth - margin) {
      left = data.rect.left + window.scrollX - PANEL_W - margin;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;

    let top = data.rect.top + window.scrollY;
    if (top + 240 > window.scrollY + window.innerHeight - margin) {
      top = window.scrollY + window.innerHeight - 240 - margin;
    }
    if (top < window.scrollY + margin) top = window.scrollY + margin;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;

    panel.innerHTML = `
      <div class="ctxvocab-header">
        <div class="ctxvocab-word" title="${escapeHtml(data.word)}">${escapeHtml(data.word)}</div>
        <button class="ctxvocab-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="ctxvocab-body">
        <div class="ctxvocab-loading">Analyzing context…</div>
      </div>
      <div class="ctxvocab-actions" hidden>
        <button class="ctxvocab-btn ctxvocab-eudic" type="button">🔍 Open in Eudic</button>
        <button class="ctxvocab-btn ctxvocab-save" type="button">＋ Save to Wordlist</button>
      </div>
      <div class="ctxvocab-status" hidden></div>
    `;

    panel.querySelector(".ctxvocab-close").addEventListener("click", removePanel);

    // Block click-outside-to-close from selecting again on the page.
    panel.addEventListener("mousedown", (e) => e.stopPropagation());

    return panel;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderResult(panel, data, parsed) {
    const body = panel.querySelector(".ctxvocab-body");
    const meaning = parsed.meaning || "(no meaning returned)";
    const inContext = parsed.in_context || "";
    const type = parsed.type || "";
    const note = parsed.note || "";

    body.innerHTML = `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">MEANING</div>
        <div class="ctxvocab-text">${escapeHtml(meaning)}</div>
      </div>
      ${inContext ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">IN THIS CONTEXT</div>
        <div class="ctxvocab-text">${escapeHtml(inContext)}</div>
      </div>` : ""}
      ${type ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">TYPE</div>
        <div class="ctxvocab-text">${escapeHtml(type)}</div>
      </div>` : ""}
      ${note ? `
      <div class="ctxvocab-section">
        <div class="ctxvocab-label">NOTE</div>
        <div class="ctxvocab-text">${escapeHtml(note)}</div>
      </div>` : ""}
    `;

    const actions = panel.querySelector(".ctxvocab-actions");
    actions.hidden = false;

    const eudicBtn = panel.querySelector(".ctxvocab-eudic");
    eudicBtn.addEventListener("click", () => openInEudic(panel, data));

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
  }

  async function openPanel(data) {
    removePanel();
    const panel = buildPanelShell(data);
    document.body.appendChild(panel);

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "LOOKUP",
        payload: {
          word: data.word,
          context: data.context,
          url: data.url
        }
      });
      if (!resp || !resp.ok) {
        renderError(panel, resp?.error || "Lookup failed.");
        return;
      }
      renderResult(panel, data, resp.parsed);
    } catch (err) {
      renderError(panel, err?.message || "Lookup failed.");
    }
  }

  function openInEudic(panel, data) {
    const url = `eudic://dict/${encodeURIComponent(data.word)}?context=${encodeURIComponent(data.context.slice(0, 300))}`;
    setStatus(panel, "Opening Eudic…", "info");
    window.location.href = url;
    setTimeout(() => setStatus(panel, "", null), 1800);
  }

  async function saveToWordlist(panel, data, parsed) {
    const btn = panel.querySelector(".ctxvocab-save");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving…";
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
        btn.textContent = "✓ Saved";
        btn.classList.add("ctxvocab-saved");
      } else if (resp?.code === "NO_TOKEN") {
        btn.textContent = "⚠ Set Eudic token in Settings";
        btn.disabled = false;
      } else {
        btn.textContent = original;
        btn.disabled = false;
        setStatus(panel, resp?.error || "Save failed.", "error");
      }
    } catch (err) {
      btn.textContent = original;
      btn.disabled = false;
      setStatus(panel, err?.message || "Save failed.", "error");
    }
  }

  // ---------- Event wiring ----------

  document.addEventListener("mouseup", (e) => {
    // Ignore mouseup originating from our own UI.
    if (e.target && (e.target.closest && e.target.closest(`#${BUTTON_ID}, #${PANEL_ID}`))) {
      return;
    }
    // Defer slightly so the selection is finalized.
    setTimeout(() => {
      const data = captureSelection();
      if (!data) {
        removeButton();
        return;
      }
      currentSelectionData = data;
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

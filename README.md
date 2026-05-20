# Context Vocab

A Chrome extension for advanced English learners. Select any word or phrase on a webpage; an AI explains it using the surrounding context, and you can save it to Eudic (欧路词典) with full provenance.

## Why

Generic dictionary lookups fail for context-dependent words. *L.I.E.* in a Wall Street screenplay means "Long Island Expressway", not the verb. Context Vocab sends the surrounding passage to the model so the explanation reflects the actual usage you're reading.

## Features

- Select any text → floating "✦ Look up" button → context-aware explanation panel
- Open the word in the Eudic desktop app (URL Scheme)
- Save the word to your Eudic study list (OpenAPI)
- Local "word log" preserves the original passage and source URL for every saved word
- Manifest V3, minimal permissions

## Install (developer mode)

1. Clone this repo.
2. Visit `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `context-vocab/` folder.
4. Click the puzzle icon → pin **Context Vocab** to the toolbar.
5. Click the toolbar icon → **Settings**, paste your DeepSeek API key and Eudic Bearer token.

## Configuration

| Field | Where to get it |
|---|---|
| DeepSeek API Key | https://platform.deepseek.com/ |
| Eudic Bearer Token | https://my.eudic.net/OpenAPI/Authorization |

Keys are stored only in `chrome.storage.local` (your own browser). Nothing is uploaded anywhere except the requests you trigger to DeepSeek and Eudic.

## Usage

1. Select a word or phrase (≤ 60 characters) on any webpage.
2. Click the floating **✦ Look up** button.
3. Read the panel: meaning, in-context interpretation, type, note.
4. Click **🔍 Open in Eudic** to open the word in the Eudic app, or **＋ Save to Wordlist** to add it to your Eudic study list.
5. Saved words are also written to a local **Word Log** with the source passage and URL — open it from the toolbar popup.

## File layout

```
context-vocab/
├── manifest.json
├── src/
│   ├── background.js   service worker (API calls + storage)
│   ├── content.js      injected into pages (selection + UI)
│   ├── panel.css       injected styles
│   ├── options.html / options.js
│   ├── popup.html   / popup.js
│   └── log.html     / log.js
└── icons/icon{16,48,128}.png
```

## Privacy

See [PRIVACY.md](PRIVACY.md). Short version: we don't run a server. Your selected text and surrounding passage are sent to DeepSeek for explanation, and saved words are sent to Eudic. Nothing else.

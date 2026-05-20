# Privacy Policy — Context Vocab

_Last updated: 2026-05-20_

Context Vocab ("the extension") is a Chrome extension that helps advanced English learners look up words in context and save them to Eudic. This policy describes what data the extension handles and where it goes.

## What the extension does NOT do

- It does not have a backend server. There is no Context Vocab service that receives, stores, or analyzes your data.
- It does not collect analytics, telemetry, or usage statistics.
- It does not read pages until you actively select text and click the "✦ Look up" button.
- It does not transmit your API keys or tokens to anyone other than the services they authenticate against (DeepSeek, Eudic).

## What data is processed

When you click "✦ Look up" on a selection:

1. The selected word/phrase, the surrounding passage (up to ~400 characters), and the page URL are sent to **DeepSeek** (https://api.deepseek.com) using the API key you configured.
2. DeepSeek returns an explanation, which is shown in the floating panel.

When you click "＋ Save to Wordlist":

1. The selected word is sent to **Eudic OpenAPI** (https://my.eudic.net) using the Bearer token you configured.
2. The full entry (word, meaning, surrounding passage, source URL/title, timestamp) is written to your browser's local storage (`chrome.storage.local`) as a "word log".

## Where data is stored

- **API keys, Eudic token, word log** — stored only in your browser via `chrome.storage.local`. They never leave your device except for the API calls described above.
- **DeepSeek and Eudic** — these third-party services receive only what you trigger them to receive. Refer to their own privacy policies for how they handle requests.

## Your control

- Clear your keys and tokens at any time via the extension's Settings page.
- Clear or export your word log at any time from the Word Log page.
- Uninstall the extension to remove all locally stored data.

## Contact

For questions or issues, open a ticket on the project repository.

# Context Vocab · 带语境的欧陆生词助手

> 一个 Chrome 插件：在网上看新闻、看文章时，划词 → AI 用语境解释 → 一键存进欧陆词典，**连同原句一起存**。

---

## 为什么会有这个东西 🤔

我是欧陆词典（Eudic）的重度用户，但我有两个一直没解决的小痛点：

1. **欧陆自己的 AI 解释太贵了。** 一个月的会员费够我喝好几杯咖啡了 ☕，作为程序员我决定用 DeepSeek 自己接（一次查询 ≈ ¥0.003，便宜到你怀疑人生）。
2. **复习的时候我经常忘了"我当时为什么要存这个词"。** 单词本里孤零零地躺着 `bullish`、`L.I.E.`、`ramification`，过两周再看完全记不起来当时是从哪篇文章里抠出来的、上下文是啥。背单词最怕的就是脱离语境——孤零零的释义记不住，**带着原句一起记才是真记得住**。

于是就有了这个插件 👇

---

## 它能干嘛

- 📰 **划词秒查**：在任何网页（华尔街日报、纽约时报、Reddit、Substack 都行）选中一个词或词组，浮出"✦ Look up"按钮。
- 🧠 **AI 看语境给解释**：不是字典里那种十几条释义让你自己挑——AI 直接告诉你：**这个词在这一段里就是这个意思**，因为前后文是这样的。
- 📖 **一键打开欧陆**：直接调起欧陆桌面 App 的词条页，享受熟悉的离线词典体验。
- ➕ **一键存进生词本**：通过欧陆 OpenAPI 写入你的学习列表，自动同步到手机端。
- 📜 **本地保存"语境档案"**：欧陆 API 只能存单词本身，所以插件会在本地额外保存一份 —— 单词、释义、**完整的原句段落**、文章标题、URL、时间。下次复习的时候打开"Word Log"，每个词都带着它当时的世界 🌍。

---

## 来个例子 🎬

你在看《华尔街之狼》的剧本：

> A cherry red Ferrari zooms down the **L.I.E.** at 95 mph.

划中 `L.I.E.` —— 词典告诉你这是"撒谎"的动词形式？❌ 不对。

AI 看到上下文后告诉你：

> **MEANING** Long Island Expressway (a major highway in New York).
> **IN THIS CONTEXT** Used here as a place where the Ferrari is speeding — referring to the highway, not "to lie".
> **TYPE** Proper noun — abbreviation for a highway name.

存到欧陆，连同那句"A cherry red Ferrari zooms down the L.I.E. at 95 mph"一起存进本地档案。两周后复习，你立刻就想起来这是从哪儿来的。✨

---

## 安装（开发者模式）

1. 克隆这个仓库：
   ```
   git clone https://github.com/kevinguo0351/context-vocab-extension.git
   ```
2. 打开 Chrome → 地址栏输入 `chrome://extensions`
3. 右上角打开 **开发者模式**
4. 点 **加载已解压的扩展程序**，选这个文件夹
5. 点拼图图标 → 把 **Context Vocab** 钉在工具栏上
6. 点工具栏的图标 → **Settings**，填两个 key（见下）

---

## 配置（一次性）

| 配置项 | 在哪儿拿 | 大概多少钱 |
|---|---|---|
| **DeepSeek API Key** | https://platform.deepseek.com/ | 按量付费，一次查词 ≈ ¥0.003 |
| **Eudic Bearer Token** | https://my.eudic.net/OpenAPI/Authorization | 免费（欧陆账号自带） |

> 🔒 两个 key 都只存在你浏览器本地（`chrome.storage.local`），不上传任何服务器。这个插件**没有后端**——你查的词只去 DeepSeek，存的词只去欧陆，别的哪都不去。详见 [PRIVACY.md](PRIVACY.md)。

---

## 怎么用

1. 在任何网页选中一个词或词组（≤ 60 字符）
2. 点冒出来的 **✦ Look up** 按钮
3. 看面板里的解释：意思、在这段里为什么是这个意思、词性、小贴士
4. 选一个：
   - 🔍 **Open in Eudic** —— 打开欧陆 App 看完整词条
   - ＋ **Save to Wordlist** —— 存进欧陆生词本
5. 想复习时，点工具栏图标 → **View Log**，所有存过的词连同当时的语境都在那

---

## 技术栈（给好奇的同学）

- Chrome Manifest V3（合规上架前提）
- DeepSeek V3 (`deepseek-chat`)：context-aware 解释
- Eudic URL Scheme：唤起 App
- Eudic OpenAPI：写入生词本
- `chrome.storage.local`：API key + 本地语境档案
- 没有打包步骤、没有 npm 依赖、纯原生 JS —— 改起来心智负担为零 🪶

文件结构：
```
context-vocab/
├── manifest.json
├── src/
│   ├── background.js   # service worker（API 调用 + 存储）
│   ├── content.js      # 注入网页（划词 + UI）
│   ├── panel.css       # 注入样式
│   ├── options.html / options.js   # 设置页
│   ├── popup.html   / popup.js     # 工具栏弹窗
│   └── log.html     / log.js       # 语境档案查看器
└── icons/icon{16,48,128}.png
```

---

## 隐私

我不开服务器，不收集数据，不发送遥测。你的词去 DeepSeek，你存的词去欧陆，仅此而已。详见 [PRIVACY.md](PRIVACY.md)。

---

## 路线图（可能会做）

- [ ] 上架 Chrome Web Store（省得每次手动装）
- [ ] 支持自定义模型（OpenAI / Claude / 本地模型）
- [ ] 复习模式：每天推几个最近存的词，带语境
- [ ] 导出 Anki 牌组（语境作为 example field）

如果你也是欧陆用户、也讨厌脱离语境背单词，欢迎 issue / PR / star ⭐

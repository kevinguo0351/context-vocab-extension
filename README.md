# Context Vocab · 带语境的欧陆生词助手
上线chrome商店了！ 
https://chromewebstore.google.com/detail/context-vocab/dhcdkpkphhkjiaogdpdcfjlanklfdkal
也可以选择在release里面下载!

> 一个 Chrome 插件：在网上看新闻、看文章时，划词 → AI 用语境解释 → 一键存进欧陆词典，**连同原句一起存**。

---

## 为什么会有这个东西 🤔

我是欧陆词典（Eudic）的重度用户，但我有两个一直没解决的小痛点：

1. **欧陆自己的 AI 解释太贵了。** 一个月的会员费够我喝好几杯咖啡了 ☕，作为程序员我决定用 DeepSeek 自己接（一次查询 ≈ ¥0.003，便宜到你怀疑人生）。
2. **复习的时候我经常忘了"我当时为什么要存这个词"。** 单词本里孤零零地躺着 `bullish`、`L.I.E.`、`ramification`，过两周再看完全记不起来当时是从哪篇文章里抠出来的、上下文是啥。背单词最怕的就是脱离语境——孤零零的释义记不住，**带着原句一起记才是真记得住**。

于是就有了这个插件 👇

---

## 它能干嘛

- 📰 **划词秒查**：在任何网页（华尔街日报、纽约时报、Reddit、Substack 都行）选中一个词或词组，浮出"✦ 查词"按钮。
- 🧠 **AI 看语境给中文解释**：不是字典里那种十几条释义让你自己挑——AI 拿到 **前后约 300 字的上下文** 后，**直接用中文** 告诉你这个词在这一段里就是这个意思，因为前后文是这样的。
- 🔗 **一键跳转三大权威词典**：朗文（LDOCE）、韦氏（Merriam-Webster）、剑桥（Cambridge，英汉双解版）—— 直接打开词条页，需要查根义、例句、发音的时候不再切来切去。
- ➕ **一键存进欧陆，连同语境一起**：通过欧陆 OpenAPI 把单词写入生词本，**同时把"此处含义 + 释义 + 原文段落 + 来源链接"作为笔记附在该词条上**，手机端打开就看得到。
- 📜 **本地保存语境档案**：插件还会在本地额外存一份完整记录——单词、释义、原句段落、文章标题、URL、时间，可搜索可导出 JSON。下次复习的时候，每个词都带着它当时的世界 🌍。

---

## 来个例子 🎬

你在看《华尔街之狼》的剧本：

> A cherry red Ferrari zooms down the **L.I.E.** at 95 mph.

划中 `L.I.E.` —— 词典告诉你这是"撒谎"的动词形式？❌ 不对。

AI 看到上下文后告诉你：

> **释义** 长岛高速公路（Long Island Expressway 的缩写），纽约的一条主要高速。
> **此处含义** 这里是法拉利疾驰的地点，指的是这条高速公路，不是"撒谎"那个动词。
> **词性** 专有名词（高速公路名缩写）。
> **备注** 在美剧、纽约相关的影视作品里经常出现，缩写在交通语境中很常见。

旁边还有 **朗文 / 韦氏 / 剑桥** 三个跳转链接，需要查根义、例句、发音时一键直达。

点"存到欧陆（带语境）"，单词进入生词本，**同时这条 AI 解释 + 原文段落 + 来源链接被作为笔记附在词条上**，手机端打开欧陆就能看到。两周后复习，你立刻想起来这是从《华尔街之狼》那一段来的。✨

---

## 🎒 便携模式（公用电脑神器）

> 适用场景：你是大学生，经常在图书馆、机房、宿舍楼下打印店等公用电脑上写作业、查资料。每次都重新填两个 API key 太烦——这个模式让你把 key **预先打包进 zip**，到目的地解压加载即用。

### 一次配置，到处使用

最简单的方式：**双击 `make-portable.cmd`**，按向导一步步来：

```
1. 输入 DeepSeek API Key
2. 输入欧陆 OpenAPI Token
3. 选择是否加密
   - 不加密 → 生成 context-vocab-portable.zip（约 23 KB）
   - 加密   → 生成 context-vocab-portable.7z（约 17 KB，AES-256，文件名也藏起来）
4. 如选加密 → 设置一个解压密码（输两次，至少 4 位）
```

也可以走 PowerShell：

```powershell
# 默认（不加密）
.\make-portable.ps1

# 直接加密版
.\make-portable.ps1 -Encrypt

# 完全非交互（可以塞到批处理里跑）
.\make-portable.ps1 -DeepSeekKey "sk-xxx" -EudicToken "yyy" -Encrypt -Password "我的密码"
```

### 在公用电脑上

**没加密（.zip）：**
1. 把 zip 拷到优盘 / 微信文件传输助手 / 自己邮箱里收一份
2. 在公用电脑上解压（双击或右键都行）
3. Chrome 打开 `chrome://extensions` → 开启**开发者模式** → **加载已解压的扩展程序** → 选解压出来的 `context-vocab` 文件夹
4. **直接划词查词**——key 会在扩展安装时从 `preset.json` 自动写入 `chrome.storage.local`

**加密版（.7z）：**
1. 把 .7z 拷到目标电脑
2. 目标电脑需要装 7-Zip（[www.7-zip.org](https://www.7-zip.org/)，2 MB，30 秒装完）
3. 右键 .7z → 7-Zip → 解压到此处 → **输入密码**
4. 后面同上（chrome://extensions → 加载已解压 → 选 context-vocab 文件夹）

> 公用电脑上没装 7-Zip 也别怕，国内电脑大多装了 WinRAR/Bandizip，这俩也能识别 AES-256 加密的 .7z。

### 用完后

`chrome://extensions` → 找到 Context Vocab → 点**移除**。Chrome 会一并清掉 `chrome.storage.local` 里的 key，不会留痕在公用电脑上。

### ⚠️ 安全须知

- **没加密的 zip 明文包含 API key**——拿到这个 zip 的人能用你的账号。优盘 / 私聊 / 自己邮箱传可以；GitHub / 公开网盘 / 大群聊不要发
- **加密 .7z 用的是 AES-256 + 文件名隐藏**——没密码连里面有什么文件都看不到，比 ZIP 自带的 ZipCrypto 强得多。但密码安全完全取决于你设的密码强度，所以别用 `123456`
- 仓库 `.gitignore` 默认屏蔽了 `*.portable.zip` 和 `*.portable.7z`，不会被你不小心 `git push` 上来
- 别人电脑借给你用？用完一定要去 `chrome://extensions` 移除扩展（同时清掉 `chrome.storage.local`）；解压出来的 `context-vocab/` 文件夹也顺手删掉
- DeepSeek 控制台和欧陆 OpenAPI 都有调用记录可以查——发现异常调用可以立即在原网站撤销 key 并重新生成

### 工作原理（给好奇的）

- `src/preset.json` 在仓库里是空的，提交到 git 也无害
- `make-portable.ps1` 在系统 TEMP 目录里 **临时复制一份** 文件树，把 key 塞进副本的 `preset.json`，打包，删除临时副本——你的工作树 `preset.json` 全程没被动过
- service worker 在 `onInstalled` 和 `onStartup` 时读 `preset.json`，**只在对应字段还没设置过时** 写入 storage（手动改的 key 永远胜出）

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

| 配置项 | 在哪儿拿 | 备注 |
|---|---|---|
| **DeepSeek API Key** | https://platform.deepseek.com/ | 按量付费，**用 `deepseek-v4-flash`**（DeepSeek 最便宜的模型），一次查词 ≈ ¥0.0007。比欧陆的 AI 会员便宜两个数量级 |
| **欧陆 OpenAPI Token** | https://my.eudic.net/OpenAPI/Authorization | 免费（欧陆账号自带）。**注意：粘贴原始 token，不要带 `Bearer` 前缀**，否则会 401 |

> 🔒 两个 key 都只存在你浏览器本地（`chrome.storage.local`），不上传任何服务器。这个插件**没有后端**——你查的词只去 DeepSeek，存的词只去欧陆，别的哪都不去。详见 [PRIVACY.md](PRIVACY.md)。

---

## 怎么用

1. 在任何网页选中一个词或词组（≤ 60 字符）
2. 点冒出来的 **✦ 查词** 按钮
3. 看面板里的中文解释：释义、此处含义、词性、备注
4. 在面板底部你可以：
   - 点 **朗文 / 韦氏 / 剑桥** 任一链接 → 直接打开对应词典网页
   - 点 **＋ 存到欧陆（带语境）** → 单词进入生词本，AI 解释 + 原文段落自动作为笔记附在词条上
5. 想复习时，点工具栏图标 → **查看语境档案**，所有存过的词连同当时的世界都在那

### 📤 导出语境档案

档案页右上角三个按钮，导成什么样取决于你下一步想干嘛：

- **JSON** —— 完整结构化数据，每条记录所有字段都在，方便自己写脚本处理
- **CSV** —— 单词、释义、此处含义、原文、来源……每一项独立一列，导入 Excel / Notion / 飞书都很顺。带 UTF-8 BOM，Windows Excel 直接打开不乱码
- **Anki** —— 专门为 Anki 准备的 .txt（TSV）。**Front = 单词**，**Back = HTML 格式的释义 + 此处含义 + 原文（自动加粗目标词）+ 来源链接**，**Tags = `context-vocab`**。文件头自带 `#separator:tab` `#html:true` `#columns:Word\tBack\tTags`，新版 Anki 一键导入即可。具体步骤导出后会弹出说明

---

## 技术栈（给好奇的同学）

- Chrome Manifest V3（合规上架前提）
- DeepSeek `deepseek-v4-flash`（最便宜的模型，$0.14/M input · $0.28/M output）：上下文窗口前后约 300 字，中文输出
- 欧陆 OpenAPI (`api.frdic.com/api/open/v1`)：先 `POST /studylist/word` 加词，再 `POST /studylist/note` 把 AI 解释 + 原文作为笔记附在词条上（注意：注释字段叫 `note`，不是 `context_line`，这点 v1.1.0 踩过坑，v1.1.1 修复）
- 朗文 / 韦氏 / 剑桥词典：网页 deep-link，无需 API（除韦氏有免费 API 外，朗文剑桥都收费）
- `chrome.storage.local`：API key + 本地语境档案
- 没有打包步骤、没有 npm 依赖、纯原生 JS —— 改起来心智负担为零 🪶

> **关于词典 API 成本**：研究下来，韦氏（Merriam-Webster）有免费 API（dictionaryapi.com，1000 次/天，仅限非商用）；朗文已经停掉了公开 API；剑桥不提供免费层，付费授权也得逐案谈。所以这个版本统一用网页跳转——免费、无 key、永远可用。如果以后需要把释义直接渲染在面板里，韦氏 API 是值得接的。

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

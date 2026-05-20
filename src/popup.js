document.getElementById("version").textContent =
  "v" + chrome.runtime.getManifest().version;

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("log").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/log.html") });
});

(async () => {
  const resp = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  if (!resp?.ok) return;

  const dsDot = document.getElementById("ds_dot");
  const dsLabel = document.getElementById("ds_label");
  const euDot = document.getElementById("eu_dot");
  const euLabel = document.getElementById("eu_label");

  if (resp.deepseek_configured) {
    dsDot.className = "dot ok";
    dsLabel.textContent = "已配置";
  }
  if (resp.eudic_configured) {
    euDot.className = "dot ok";
    euLabel.textContent = "已配置";
  }
  document.getElementById("saves").textContent = String(resp.saves_total || 0);
})();

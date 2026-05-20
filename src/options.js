const $ds = document.getElementById("deepseek_key");
const $eu = document.getElementById("eudic_token");
const $save = document.getElementById("save");
const $clear = document.getElementById("clear");
const $status = document.getElementById("status");

async function load() {
  const { deepseek_key, eudic_token } = await chrome.storage.local.get(["deepseek_key", "eudic_token"]);
  $ds.value = deepseek_key || "";
  $eu.value = eudic_token || "";
}

function flashStatus(msg, isError) {
  $status.textContent = msg;
  $status.style.color = isError ? "#ff8a8a" : "";
  $status.hidden = false;
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => { $status.hidden = true; }, 2200);
}

$save.addEventListener("click", async () => {
  await chrome.storage.local.set({
    deepseek_key: $ds.value.trim(),
    eudic_token: $eu.value.trim()
  });
  flashStatus("已保存。");
});

$clear.addEventListener("click", async () => {
  await chrome.storage.local.remove(["deepseek_key", "eudic_token"]);
  $ds.value = "";
  $eu.value = "";
  flashStatus("已清除。");
});

load();

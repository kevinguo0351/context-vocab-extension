#requires -Version 5.1
<#
.SYNOPSIS
  Build a portable Context Vocab extension with API keys baked in.

.DESCRIPTION
  Prompts for your DeepSeek API key and Eudic Bearer token, then produces
  a portable archive in the repo root.

  Two output modes:
    - Plain (default):  context-vocab-portable.zip
    - Encrypted (-Encrypt or interactive yes):
                       context-vocab-portable.7z, AES-256 with header encryption.
                       Requires 7-Zip locally AND on the target computer.

  The working tree's src/preset.json is NEVER modified — keys only live
  inside the archive. You can build a portable bundle from a clone of the
  public repo without risking a leak via `git push`.

.PARAMETER DeepSeekKey
  DeepSeek API key. If omitted, prompted interactively.

.PARAMETER EudicToken
  Eudic Bearer token (raw, no Bearer prefix). If omitted, prompted interactively.

.PARAMETER Encrypt
  Switch. If present, output an AES-256 encrypted .7z. Requires 7-Zip.

.PARAMETER Password
  Password for the encrypted archive. If -Encrypt is set without -Password,
  prompted interactively (twice for confirmation).

.PARAMETER OutputPath
  Override the output archive path. Default is ./context-vocab-portable.{zip|7z}.

.NOTES
  Anyone with a filled-in copy of the resulting archive has full access to
  your DeepSeek and Eudic accounts. Treat it like a password file.
#>

[CmdletBinding()]
param(
  [string]$DeepSeekKey,
  [string]$EudicToken,
  [switch]$Encrypt,
  [string]$Password,
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

# ---------- Helpers ----------

function Find-SevenZip {
  $candidates = @(
    "$env:ProgramFiles\7-Zip\7z.exe",
    "${env:ProgramFiles(x86)}\7-Zip\7z.exe",
    "$env:LOCALAPPDATA\Programs\7-Zip\7z.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $cmd = Get-Command 7z.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command 7z -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  return $null
}

function Read-PasswordTwice {
  param([string]$Prompt = "设置解压密码")
  while ($true) {
    $p1 = Read-Host "$Prompt" -AsSecureString
    $p2 = Read-Host "再输一次确认" -AsSecureString
    $b1 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1)
    $b2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2)
    try {
      $s1 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($b1)
      $s2 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($b2)
    } finally {
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b1)
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b2)
    }
    if ($s1 -ne $s2) {
      Write-Host "两次输入不一致，重试。" -ForegroundColor Yellow
      continue
    }
    if ([string]::IsNullOrEmpty($s1) -or $s1.Length -lt 4) {
      Write-Host "密码太短（至少 4 位），重试。" -ForegroundColor Yellow
      continue
    }
    return $s1
  }
}

function Read-YesNo {
  param([string]$Prompt, [string]$Default = "n")
  $hint = if ($Default -eq "y") { "[Y/n]" } else { "[y/N]" }
  while ($true) {
    $ans = Read-Host "$Prompt $hint"
    if (-not $ans) { $ans = $Default }
    switch ($ans.Trim().ToLower()) {
      "y"   { return $true }
      "yes" { return $true }
      "n"   { return $false }
      "no"  { return $false }
    }
    Write-Host "请输入 y 或 n。" -ForegroundColor Yellow
  }
}

# ---------- Banner + key collection ----------

Write-Host ""
Write-Host "Context Vocab — 便携模式打包" -ForegroundColor Cyan
Write-Host "----------------------------------------"
Write-Host ""
Write-Host "⚠️  生成的压缩包会包含你的 API key（明文，除非加密）。" -ForegroundColor Yellow
Write-Host "    任何拿到压缩包的人都能用你的 DeepSeek + 欧陆账号。"
Write-Host "    不要发到公开网络（GitHub / 微博 / 公开群聊）。"
Write-Host ""

if (-not $DeepSeekKey) {
  $DeepSeekKey = Read-Host "DeepSeek API Key (sk-...)"
}
if (-not $EudicToken) {
  $EudicToken = Read-Host "欧陆 OpenAPI Token (粘贴原始 token，无 Bearer 前缀)"
}

$DeepSeekKey = $DeepSeekKey.Trim()
$EudicToken  = $EudicToken.Trim()

if (-not $DeepSeekKey -and -not $EudicToken) {
  Write-Host "两个 key 都为空，没必要打包便携版。" -ForegroundColor Red
  exit 1
}

# ---------- Encryption decision ----------

if (-not $PSBoundParameters.ContainsKey('Encrypt')) {
  Write-Host ""
  Write-Host "是否给压缩包加密？" -ForegroundColor Cyan
  Write-Host "  - 加密：AES-256，连文件名都看不到，但目标电脑需要装 7-Zip 才能解压"
  Write-Host "  - 不加密：普通 .zip，Windows 资源管理器双击就能解开"
  $Encrypt = Read-YesNo "需要加密吗" "n"
}

$sevenZip = $null
if ($Encrypt) {
  $sevenZip = Find-SevenZip
  if (-not $sevenZip) {
    Write-Host ""
    Write-Host "❌ 没找到 7-Zip。加密功能需要本机安装 7-Zip。" -ForegroundColor Red
    Write-Host "   下载: https://www.7-zip.org/" -ForegroundColor Red
    Write-Host "   装好后重新运行此脚本。"
    exit 1
  }
  Write-Host ""
  Write-Host "✓ 找到 7-Zip: $sevenZip" -ForegroundColor DarkGray
  if (-not $Password) {
    $Password = Read-PasswordTwice "设置解压密码"
  }
}

# ---------- Default output path ----------

if (-not $OutputPath) {
  $ext = if ($Encrypt) { "7z" } else { "zip" }
  $OutputPath = Join-Path $root "context-vocab-portable.$ext"
}

# ---------- Stage + bake keys ----------

$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("context-vocab-build-" + [guid]::NewGuid())
$inner   = Join-Path $staging "context-vocab"
New-Item -ItemType Directory -Path $inner -Force | Out-Null

try {
  Copy-Item -Path (Join-Path $root "manifest.json") -Destination $inner
  Copy-Item -Path (Join-Path $root "src")           -Destination $inner -Recurse
  Copy-Item -Path (Join-Path $root "icons")         -Destination $inner -Recurse

  $stagedPreset = Join-Path $inner "src\preset.json"
  $presetObj = [ordered]@{
    "_comment"     = "Portable build. Generated by make-portable.ps1. Do not commit."
    "deepseek_key" = $DeepSeekKey
    "eudic_token"  = $EudicToken
  }
  ($presetObj | ConvertTo-Json -Depth 4) | Set-Content -Path $stagedPreset -Encoding UTF8

  if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }

  if ($Encrypt) {
    # 7-Zip with AES-256 + header encryption (filenames hidden too).
    # Pass password via -p<value>; 7z exits non-zero on any failure.
    $args = @(
      "a", "-t7z",
      "-mhe=on",
      "-mx=5",
      "-p$Password",
      $OutputPath,
      $inner
    )
    & $sevenZip @args | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "7-Zip 打包失败 (exit $LASTEXITCODE)"
    }
  } else {
    Compress-Archive -Path $inner -DestinationPath $OutputPath -Force
  }

  $size = (Get-Item $OutputPath).Length
  Write-Host ""
  Write-Host "✅ 打包完成:" -ForegroundColor Green
  Write-Host ("   {0}" -f $OutputPath)
  Write-Host ("   {0:N1} KB" -f ($size / 1KB))
  if ($Encrypt) {
    Write-Host "   加密: AES-256 + 文件名隐藏" -ForegroundColor DarkGreen
  }
  Write-Host ""
  Write-Host "在公用电脑上的使用流程:" -ForegroundColor Cyan
  if ($Encrypt) {
    Write-Host "  1. 把 .7z 拷到优盘 / 微信发到目标电脑"
    Write-Host "  2. 目标电脑需要装 7-Zip (https://www.7-zip.org/)"
    Write-Host "  3. 右键 .7z → 7-Zip → 解压到此处 → 输入密码（会得到 context-vocab/ 文件夹）"
    Write-Host "  4. Chrome 打开 chrome://extensions"
    Write-Host "  5. 开启「开发者模式」→「加载已解压的扩展程序」→ 选 context-vocab 文件夹"
    Write-Host "  6. 直接划词查词，API key 已自动写入"
  } else {
    Write-Host "  1. 把 .zip 拷到优盘 / 微信发到目标电脑"
    Write-Host "  2. 解压（双击或右键解压都行，会得到 context-vocab/ 文件夹）"
    Write-Host "  3. Chrome 打开 chrome://extensions"
    Write-Host "  4. 开启「开发者模式」→「加载已解压的扩展程序」→ 选 context-vocab 文件夹"
    Write-Host "  5. 直接划词查词，API key 已自动写入"
  }
  Write-Host ""
  Write-Host "用完后:" -ForegroundColor Cyan
  Write-Host "  chrome://extensions → 移除 Context Vocab"
  Write-Host "  顺手把解压出来的 context-vocab 文件夹也删掉"
  Write-Host ""
  Write-Host "工作树状态:" -ForegroundColor DarkGray
  Write-Host "  src/preset.json 没有被修改（仍是空 key）"
  Write-Host "  压缩包已加进 .gitignore，不会被 git 追踪"
}
finally {
  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
}

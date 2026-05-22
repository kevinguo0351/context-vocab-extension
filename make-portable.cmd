@echo off
chcp 65001 >nul
title Context Vocab - 便携模式打包向导
cd /d "%~dp0"

cls
echo.
echo ============================================================
echo   Context Vocab  ·  便携模式打包向导
echo ============================================================
echo.
echo 这个工具会问你几个问题, 然后生成一个可以带在优盘里
echo 或者通过微信发到任何电脑的压缩包. 解压加载就能直接用,
echo 不用每次重新填 API key.
echo.
echo 你需要准备好两样东西:
echo.
echo   1. DeepSeek API Key
echo      申请地址: https://platform.deepseek.com/
echo      格式:     sk- 开头的一串字符
echo.
echo   2. 欧陆 OpenAPI Token
echo      获取地址: https://my.eudic.net/OpenAPI/Authorization
echo      格式:     原始 token, 不要带 Bearer 前缀
echo.
echo ============================================================
echo.
pause
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-portable.ps1"
set ec=%errorlevel%

echo.
echo ============================================================
if %ec% neq 0 (
  echo   ⚠ 打包过程中出现问题, 退出码 = %ec%
  echo     检查上方报错信息, 或者重新运行此向导.
) else (
  echo   ✅ 完成. 压缩包已生成在当前文件夹.
  echo.
  echo   现在你可以:
  echo     - 拷到优盘
  echo     - 在微信文件传输助手里发给自己
  echo     - 发到自己的邮箱里收一份
  echo.
  echo   ⚠ 切记: 不要把这个压缩包发到 GitHub / 公开网盘 / 大群聊.
)
echo ============================================================
echo.
echo 按任意键关闭窗口...
pause >nul

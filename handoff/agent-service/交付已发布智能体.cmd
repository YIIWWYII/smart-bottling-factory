@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is missing. Install Node.js 24 LTS for Windows x64, then reopen this window. & echo Download: https://nodejs.org/en/download & pause & exit /b 1)
node -e "const v=Number(process.versions.node.split('.')[0]);if(v<24)process.exit(1)" || (echo Node.js 24 or newer is required. Current: & node --version & pause & exit /b 1)
set "COZE_UPSTREAM=http://127.0.0.1:8888"
set "AGENT_PORT=8889"
node server.mjs
pause

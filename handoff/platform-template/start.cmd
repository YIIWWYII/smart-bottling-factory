@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is missing. Install Node.js 24 LTS for Windows x64, then reopen this window. & echo Download: https://nodejs.org/en/download & pause & exit /b 1)
node -e "const v=Number(process.versions.node.split('.')[0]);if(v<24)process.exit(1)" || (echo Node.js 24 or newer is required. Current: & node --version & pause & exit /b 1)
where docker >nul 2>nul || (echo Docker Desktop is missing. Install Docker Desktop for Windows, then restart Windows. & echo Download: https://www.docker.com/products/docker-desktop/ & pause & exit /b 1)
docker info >nul 2>nul || (echo Docker Desktop is installed but its engine is not running. Open Docker Desktop and wait for Engine running, then run this file again. & pause & exit /b 1)
if not exist .env copy .env.handoff.example .env >nul
echo First startup downloads the MySQL 8.4 image and Node dependencies. Internet access is required once.
docker compose -p bottleworks-handoff -f docker-compose.demo.yml up -d --wait || (pause & exit /b 1)
if not exist node_modules\vite\bin\vite.js (
  echo Installing the platform's locked Node dependencies with npm ci...
  call npm ci || (pause & exit /b 1)
)
set "VISION_DEMO_HOST=127.0.0.1"
set "VISION_DEMO_PORT=18093"
set "AGENT_HOST=127.0.0.1"
set "AGENT_PORT=8887"
echo Open http://127.0.0.1:5174/ and give testers http://YOUR-LAN-IP:5174/.
node start-platform-handoff.mjs
pause

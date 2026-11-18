@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 24 LTS first. Download: https://nodejs.org/en/download & pause & exit /b 1)
where node >nul 2>nul
cd model || (pause & exit /b 1)
if not exist runtime\llama-server.exe (echo llama-server.exe is missing from model\runtime. Re-extract the complete agent package. & pause & exit /b 1)
if not exist models\base-model.gguf (echo Base model is missing from model\models. Re-extract the complete agent package. & pause & exit /b 1)
if not exist models\adapter.gguf (echo Adapter is missing from model\models. Re-extract the complete agent package. & pause & exit /b 1)
echo Qwen3.5-4B + LoRA adapted model service
echo Check your LAN IPv4 address with ipconfig. This server uses port 8004.
echo Allow private-network inbound TCP 8004 if the other computer cannot connect.
echo Keep this window open while the model is in use. CPU responses can be slow.
echo.
runtime\llama-server.exe --model models\base-model.gguf --lora models\adapter.gguf --chat-template-file models\qwen35_chat_template.jinja --alias bottle-qwen35-lora --host 0.0.0.0 --port 8004 --api-key "sk-bottle-8004,local" --ctx-size 8192 --parallel 1 --n-gpu-layers 0 --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --jinja --reasoning-budget 0 --threads 8 --batch-size 256 --ubatch-size 128
if errorlevel 1 echo Model service exited with an error. Check runtime files and available memory.
pause

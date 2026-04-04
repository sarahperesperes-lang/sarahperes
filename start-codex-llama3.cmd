@echo off
title Codex + Ollama + llama3
setlocal

set "PROJECT_DIR=C:\Users\a8912\WebstormProjects\sarahperes"
set "PORTAL_URL=http://127.0.0.1:8787/"
set "HEALTH_URL=http://127.0.0.1:8787/api/health"

echo ==========================================
echo   INICIANDO CODEX + GATEWAY LOCAL + LLAMA3
echo ==========================================
echo.
echo Projeto ativo : %PROJECT_DIR%
echo Portal local  : %PORTAL_URL%
echo Modelo Codex  : llama3
echo.

start "Ollama" cmd /k "ollama serve"
timeout /t 4 > nul

start "Gateway Local" cmd /k "cd /d %PROJECT_DIR% && start-secure-local.cmd"
timeout /t 8 > nul

start "Codex" cmd /k "cd /d %PROJECT_DIR% && ollama launch codex --model llama3:latest"
timeout /t 4 > nul

echo Health check:
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 20; $json = $r.Content | ConvertFrom-Json; Write-Host ('STATUS: ' + $r.StatusCode); Write-Host ('PROJECT ROOT: ' + $json.projectRoot); Write-Host ('PROVIDER: ' + $json.provider); Write-Host ('RESOLVED MODEL: ' + $json.resolvedModel); Write-Host ('FALLBACK USED: ' + $json.fallbackUsed) } catch { Write-Host 'Falha ao consultar o health local.'; Write-Host $_.Exception.Message }"

echo.
echo Backend local ativo a partir de: %PROJECT_DIR%
echo.
pause

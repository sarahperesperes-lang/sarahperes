param(
  [string]$OllamaHost = 'http://127.0.0.1:11434',
  [string]$SiteModel = 'glm-4.7-flash:latest',
  [string]$BotModel = 'glm-4.7-flash:latest',
  [string]$FallbackModel = 'llama3:latest',
  [int]$NumCtx = 2048,
  [int]$FallbackNumCtx = 1024,
  [int]$PrimaryTimeoutMs = 18000,
  [int]$FallbackTimeoutMs = 120000,
  [int]$PrimaryCooldownMs = 600000,
  [string]$ApiPassword = '324125'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$content = @"
AI_PROVIDER=ollama
OLLAMA_HOST=$OllamaHost
SITE_OLLAMA_MODEL=$SiteModel
BOT_OLLAMA_MODEL=$BotModel
OLLAMA_FALLBACK_MODEL=$FallbackModel
OLLAMA_NUM_CTX=$NumCtx
OLLAMA_FALLBACK_NUM_CTX=$FallbackNumCtx
OLLAMA_PRIMARY_TIMEOUT_MS=$PrimaryTimeoutMs
OLLAMA_FALLBACK_TIMEOUT_MS=$FallbackTimeoutMs
OLLAMA_PRIMARY_COOLDOWN_MS=$PrimaryCooldownMs
API_ACCESS_PASSWORD=$ApiPassword
PORT=8787
HOST=127.0.0.1
"@

[System.IO.File]::WriteAllText("$root\.env.local", $content, (New-Object System.Text.UTF8Encoding($false)))
attrib +h "$root\.env.local" | Out-Null
Write-Host '.env.local atualizado para usar Ollama local.' -ForegroundColor Green

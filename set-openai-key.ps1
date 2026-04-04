param(
  [string]$OllamaHost = 'http://127.0.0.1:11434',
  [string]$SiteModel = 'codellama:13b-code-q4_K_M',
  [string]$BotModel = 'codellama:13b-code-q4_K_M',
  [string]$FallbackModel = 'llama3:latest',
  [string]$ApiPassword = '324125'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

@"
OLLAMA_HOST=$OllamaHost
SITE_OLLAMA_MODEL=$SiteModel
BOT_OLLAMA_MODEL=$BotModel
OLLAMA_FALLBACK_MODEL=$FallbackModel
API_ACCESS_PASSWORD=$ApiPassword
PORT=8787
HOST=127.0.0.1
"@ | Set-Content -Path "$root\.env.local" -Encoding UTF8

attrib +h "$root\.env.local" | Out-Null
Write-Host '.env.local atualizado para usar Ollama local.' -ForegroundColor Green

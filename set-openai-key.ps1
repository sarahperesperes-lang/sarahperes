param(
  [string]$SiteApiKey,
  [string]$BotApiKey
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SiteApiKey) {
  $SiteApiKey = Read-Host 'Cole sua chave do site (OPENAI_API_KEY)'
}
if (-not $SiteApiKey) {
  Write-Host 'Nenhuma chave do site informada.' -ForegroundColor Yellow
  exit 1
}
if (-not $BotApiKey) {
  $BotApiKey = Read-Host 'Cole sua chave do bot (BOT_OPENAI_API_KEY) ou deixe vazio'
}

@"
OPENAI_API_KEY=$SiteApiKey
BOT_OPENAI_API_KEY=$BotApiKey
PORT=8787
HOST=127.0.0.1
"@ | Set-Content -Path "$root\.env.local" -Encoding UTF8
attrib +h "$root\.env.local" | Out-Null
Write-Host '.env.local atualizado com perfil de site e bot e ocultado.' -ForegroundColor Green

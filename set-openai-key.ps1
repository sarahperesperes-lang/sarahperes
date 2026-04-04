param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [string]$SiteModel = 'gpt-4.1-mini',
  [string]$BotModel = 'gpt-4.1-mini',
  [string]$ApiPassword = '324125'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$content = @"
AI_PROVIDER=openai
OPENAI_API_KEY=$ApiKey
SITE_OPENAI_MODEL=$SiteModel
BOT_OPENAI_MODEL=$BotModel
API_ACCESS_PASSWORD=$ApiPassword
PORT=8787
HOST=127.0.0.1
"@

[System.IO.File]::WriteAllText("$root\.env.local", $content, (New-Object System.Text.UTF8Encoding($false)))
attrib +h "$root\.env.local" | Out-Null
Write-Host '.env.local atualizado para usar OpenAI no backend local.' -ForegroundColor Green

param(
  [string]$ApiKey
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ApiKey) {
  $ApiKey = Read-Host 'Cole sua OPENAI_API_KEY'
}
if (-not $ApiKey) {
  Write-Host 'Nenhuma chave informada.' -ForegroundColor Yellow
  exit 1
}

@"
OPENAI_API_KEY=$ApiKey
PORT=8787
HOST=127.0.0.1
"@ | Set-Content -Path "$root\.env.local" -Encoding UTF8
attrib +h "$root\.env.local" | Out-Null
Write-Host '.env.local atualizado e ocultado.' -ForegroundColor Green

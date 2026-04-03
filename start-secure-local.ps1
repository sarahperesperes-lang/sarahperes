$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$userSiteKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
$userSiteAlias = [Environment]::GetEnvironmentVariable('SITE_OPENAI_API_KEY', 'User')
$userLegacySite = [Environment]::GetEnvironmentVariable('ADMKEY', 'User')

if (
  -not (Test-Path "$root\.env.local") -and
  -not $env:OPENAI_API_KEY -and
  -not $env:SITE_OPENAI_API_KEY -and
  -not $env:ADMKEY -and
  -not $userSiteKey -and
  -not $userSiteAlias -and
  -not $userLegacySite
) {
  Write-Host "Nenhuma chave local encontrada. Use set-openai-key.ps1 ou variaveis de ambiente do Windows." -ForegroundColor Yellow
  exit 1
}

$healthUrl = 'http://127.0.0.1:8787/api/health'
try {
  $existing = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 2
  if ($existing.StatusCode -eq 200) {
    Start-Process 'http://127.0.0.1:8787/'
    Write-Host 'Servidor local ja estava rodando. Abri o portal no navegador.' -ForegroundColor Green
    exit 0
  }
} catch {}

Start-Process 'http://127.0.0.1:8787/'
node "$root\local-secure-server.mjs"

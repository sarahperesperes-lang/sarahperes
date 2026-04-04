$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

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

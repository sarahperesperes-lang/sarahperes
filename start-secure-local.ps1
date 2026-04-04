$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$healthUrl = 'http://127.0.0.1:8787/api/health'
try {
  $existing = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 2
  if ($existing.StatusCode -eq 200) {
    $payload = $existing.Content | ConvertFrom-Json
    if ($payload.projectRoot -eq $root) {
      Start-Process 'http://127.0.0.1:8787/'
      Write-Host 'Servidor local ja estava rodando nesta copia. Abri o portal no navegador.' -ForegroundColor Green
      exit 0
    }

    $listener = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
      Stop-Process -Id ([int]$listener.OwningProcess) -Force
      Start-Sleep -Seconds 2
      Write-Host "Servidor local antigo encerrado. Ativando a copia em $root." -ForegroundColor Yellow
    }
  }
} catch {}

Start-Process 'http://127.0.0.1:8787/'
node "$root\local-secure-server.mjs"

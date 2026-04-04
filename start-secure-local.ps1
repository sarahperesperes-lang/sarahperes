$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$healthUrl = 'http://127.0.0.1:8787/api/health'
$logDir = Join-Path $root '.local-logs'
$stdoutLog = Join-Path $logDir 'secure-local.out.log'
$stderrLog = Join-Path $logDir 'secure-local.err.log'

function Get-HealthPayload {
  try {
    $response = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      return $response.Content | ConvertFrom-Json
    }
  } catch {}
  return $null
}

$existingPayload = Get-HealthPayload
if ($null -ne $existingPayload) {
  if ($existingPayload.projectRoot -eq $root) {
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

try {
  $ollama = Invoke-WebRequest 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 4
  if ($ollama.StatusCode -ne 200) {
    Write-Host 'Ollama nao respondeu corretamente em http://127.0.0.1:11434.' -ForegroundColor Yellow
    exit 1
  }
} catch {
  Write-Host 'Ollama nao esta ativo. Inicie o Ollama antes de subir o gateway local.' -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

Start-Process -FilePath 'node' -ArgumentList "`"$root\local-secure-server.mjs`"" -WorkingDirectory $root -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog | Out-Null

for ($attempt = 1; $attempt -le 20; $attempt++) {
  Start-Sleep -Milliseconds 750
  $payload = Get-HealthPayload
  if ($null -ne $payload -and $payload.projectRoot -eq $root) {
    Start-Process 'http://127.0.0.1:8787/'
    Write-Host "Servidor local ativo em $root. Portal aberto no navegador." -ForegroundColor Green
    exit 0
  }
}

Write-Host 'O servidor local nao ficou pronto a tempo.' -ForegroundColor Red
Write-Host "Confira os logs em $stdoutLog e $stderrLog" -ForegroundColor Yellow
exit 1

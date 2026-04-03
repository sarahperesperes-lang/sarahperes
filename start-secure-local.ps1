$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path "$root\.env.local")) {
  Write-Host "Arquivo .env.local nao encontrado. Rode set-openai-key.ps1 para salvar sua chave localmente." -ForegroundColor Yellow
  exit 1
}

$healthUrl = 'http://127.0.0.1:8787/api/health'
try {
  $existing = Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 2
  if ($existing.StatusCode -eq 200) {
    Start-Process 'http://127.0.0.1:8787/hipofise-workspace.html'
    Write-Host 'Servidor local ja estava rodando. Abri o workspace da hipofise no navegador.' -ForegroundColor Green
    exit 0
  }
} catch {}

Start-Process 'http://127.0.0.1:8787/hipofise-workspace.html'
node "$root\local-secure-server.mjs"

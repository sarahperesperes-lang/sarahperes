$ErrorActionPreference = 'SilentlyContinue'

$listening = netstat -ano | Select-String ':8787'
if (-not $listening) {
  Write-Host 'Nenhum servidor local seguro rodando na porta 8787.' -ForegroundColor Yellow
  exit 0
}

$pids = @{}
foreach ($line in $listening) {
  $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
  if ($parts.Length -ge 5) {
    $pid = $parts[-1]
    if ($pid -match '^\d+$' -and $pid -ne '0') {
      $pids[$pid] = $true
    }
  }
}

if ($pids.Count -eq 0) {
  Write-Host 'Nenhum processo local elegivel foi encontrado na porta 8787.' -ForegroundColor Yellow
  exit 0
}

foreach ($pid in $pids.Keys) {
  taskkill /PID $pid /F | Out-Null
}

Write-Host 'Servidor local seguro encerrado.' -ForegroundColor Green

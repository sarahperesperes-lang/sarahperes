$ErrorActionPreference = 'SilentlyContinue'
$connections = Get-NetTCPConnection -LocalPort 8787 -State Listen
if (-not $connections) {
  Write-Host 'Nenhum servidor local seguro rodando na porta 8787.' -ForegroundColor Yellow
  exit 0
}
$stopped = @{}
foreach ($conn in $connections) {
  if (-not $stopped.ContainsKey($conn.OwningProcess)) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    $stopped[$conn.OwningProcess] = $true
  }
}
Write-Host 'Servidor local seguro encerrado.' -ForegroundColor Green

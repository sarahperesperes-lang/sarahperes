param(
  [string]$Prompt = 'Explique em 5 linhas a diferenca entre delirium e demencia.'
)

$ErrorActionPreference = 'Stop'
$body = @{
  model = 'gpt-4.1-mini'
  input = $Prompt
} | ConvertTo-Json -Depth 6

$response = Invoke-WebRequest `
  -Uri 'http://127.0.0.1:8787/api/bot/responses' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body `
  -UseBasicParsing

$response.Content

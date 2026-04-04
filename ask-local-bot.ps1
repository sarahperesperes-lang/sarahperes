param(
  [string]$Prompt = 'Explique em 5 linhas a diferenca entre delirium e demencia.',
  [string]$Password = '324125'
)

$ErrorActionPreference = 'Stop'
$body = @{
  model = 'llama3:latest'
  input = $Prompt
} | ConvertTo-Json -Depth 6

$response = Invoke-WebRequest `
  -Uri 'http://127.0.0.1:8787/api/bot/responses' `
  -Method Post `
  -ContentType 'application/json' `
  -Headers @{ 'x-api-password' = $Password } `
  -Body $body `
  -UseBasicParsing

$response.Content

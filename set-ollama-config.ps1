param(
  [string]$OllamaHost = 'http://127.0.0.1:11434',
  [string]$SiteModel = 'codellama:13b-code-q4_K_M',
  [string]$BotModel = 'codellama:13b-code-q4_K_M',
  [string]$FallbackModel = 'llama3:latest',
  [string]$ApiPassword = '324125'
)

powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\set-openai-key.ps1" `
  -OllamaHost $OllamaHost `
  -SiteModel $SiteModel `
  -BotModel $BotModel `
  -FallbackModel $FallbackModel `
  -ApiPassword $ApiPassword

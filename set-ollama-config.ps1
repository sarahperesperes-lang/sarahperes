param(
  [string]$OllamaHost = 'http://127.0.0.1:11434',
  [string]$SiteModel = 'llama3:latest',
  [string]$BotModel = 'llama3:latest',
  [string]$ApiPassword = '324125'
)

powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\set-openai-key.ps1" `
  -OllamaHost $OllamaHost `
  -SiteModel $SiteModel `
  -BotModel $BotModel `
  -ApiPassword $ApiPassword

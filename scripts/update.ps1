$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

docker compose pull
docker compose build --pull panel
docker compose up -d --remove-orphans
docker image prune -f --filter "until=168h"
Write-Host "Imagens atualizadas. O Bedrock verificara a versao mais recente ao iniciar." -ForegroundColor Green

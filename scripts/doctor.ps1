$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "== Docker ==" -ForegroundColor Cyan
docker version --format 'Engine: {{.Server.Version}}'
docker compose version

Write-Host "== Configuracao ==" -ForegroundColor Cyan
if (-not (Test-Path ".env")) { throw ".env ausente: execute scripts/setup.ps1" }
docker compose config --quiet

Write-Host "== Servicos ==" -ForegroundColor Cyan
docker compose ps

Write-Host "== Ultimas linhas ==" -ForegroundColor Cyan
docker compose logs --tail=20 bedrock panel

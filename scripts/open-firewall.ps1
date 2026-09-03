# Execute este arquivo em um PowerShell aberto como Administrador.
$ErrorActionPreference = "Stop"

$existing = Get-NetFirewallRule -DisplayName "Minecraft Bedrock UDP 19132" -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule `
        -DisplayName "Minecraft Bedrock UDP 19132" `
        -Direction Inbound `
        -Action Allow `
        -Protocol UDP `
        -LocalPort 19132 `
        -Profile Private
}

Write-Host "Regra criada para UDP 19132 apenas em redes privadas." -ForegroundColor Green

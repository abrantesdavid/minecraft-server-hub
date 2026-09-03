$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function New-RandomHex([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToHexString($buffer).ToLowerInvariant()
}

function Set-EnvValue([string]$Name, [string]$Value) {
    $content = Get-Content ".env" -Raw
    $escaped = [Regex]::Escape($Name)
    $content = [Regex]::Replace($content, "(?m)^$escaped=.*$", "$Name=$Value")
    [IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), $content)
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker nao foi encontrado. Instale o Docker Desktop e tente novamente."
}

docker compose version | Out-Null

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Set-EnvValue "PANEL_ADMIN_TOKEN" (New-RandomHex 32)
    Set-EnvValue "CONSOLE_PASSWORD" (New-RandomHex 24)
    Write-Host "Arquivo .env criado com segredos aleatorios." -ForegroundColor Green
}

if (Select-String -Path ".env" -Pattern '^EULA=FALSE$' -Quiet) {
    $answer = Read-Host "Digite ACEITO se voce leu e aceita a EULA (https://www.minecraft.net/eula)"
    if ($answer -cne "ACEITO") {
        throw "Instalacao cancelada: a EULA precisa ser aceita explicitamente."
    }
    Set-EnvValue "EULA" "TRUE"
}

New-Item -ItemType Directory -Force -Path "data" | Out-Null
docker compose pull
docker compose build --pull panel
docker compose up -d

$panelPort = ((Get-Content ".env" | Select-String '^PANEL_PORT=').Line -split '=', 2)[1]
if (-not $panelPort) { $panelPort = "8080" }
Write-Host "Servidor iniciado. Painel local: http://127.0.0.1:$panelPort" -ForegroundColor Green
Write-Host "O token de entrada esta em .env e nunca deve ser enviado ao GitHub."

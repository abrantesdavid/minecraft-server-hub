# Instalação no Windows 11

## 1. Pré-requisitos

Instale:

- Git for Windows;
- Docker Desktop;
- WSL 2, quando solicitado pelo Docker Desktop.

Abra o Docker Desktop e espere a mensagem de que o engine está em execução.
Não é necessário instalar Node.js ou o servidor Bedrock manualmente.

## 2. Clonar o repositório

No PowerShell:

```powershell
cd $HOME\Documents
git clone URL-DESTE-REPOSITORIO minecraft-bedrock-hub
cd minecraft-bedrock-hub
```

Substitua `URL-DESTE-REPOSITORIO` pela URL mostrada no botão **Code** do GitHub.

## 3. Criar segredos e iniciar

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

O instalador:

1. cria `.env` sem enviar o arquivo ao GitHub;
2. gera dois segredos criptograficamente aleatórios;
3. pede a aceitação explícita da EULA;
4. baixa as imagens necessárias;
5. constrói o painel e inicia o conjunto.

Abra `http://127.0.0.1:8080`. Para ver o token de login sem imprimir o outro
segredo:

```powershell
(Get-Content .env | Select-String '^PANEL_ADMIN_TOKEN=').Line
```

Copie somente o texto depois do sinal `=`.

## 4. Permitir jogadores na rede local

Abra o PowerShell **como Administrador** e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\open-firewall.ps1
```

A regra libera UDP 19132 apenas no perfil de rede Privada. Descubra o IPv4 do
computador com:

```powershell
ipconfig
```

No Minecraft Bedrock de outro dispositivo da mesma rede, adicione um servidor
com o IPv4 encontrado e a porta `19132`.

## 5. Inicialização automática do Docker

No Docker Desktop, abra **Settings > General** e habilite a inicialização com o
Windows. Como os serviços usam `restart: unless-stopped`, eles voltam após o
Docker iniciar, exceto quando foram parados explicitamente.

## 6. Levar o repositório para outro computador

O código pode ser clonado novamente pelo GitHub, mas o mundo não é enviado ao
repositório. Use o botão **Baixar mundo (.mcworld)** no painel ou copie a pasta
`data` com o servidor desligado.

Nunca copie o `.env` para uma máquina não confiável. Se precisar mover a
instalação, transfira-o de forma privada ou gere novos segredos no destino.

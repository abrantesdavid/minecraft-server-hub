# Cloudflare Tunnel e Access para o painel

Esta configuração publica somente o painel HTTP. O jogo Bedrock usa UDP e é
tratado separadamente em [NETWORK.md](NETWORK.md).

## 1. Criar o túnel

No painel Zero Trust da Cloudflare:

1. abra **Networks > Tunnels**;
2. crie um túnel do tipo `cloudflared`;
3. instale o conector no mesmo computador do Minecraft;
4. crie um hostname público, por exemplo `admin.seudominio.com`;
5. selecione o serviço `HTTP` e a URL `127.0.0.1:8080`.

Se preferir configuração por arquivo, copie
`cloudflare/config.yml.example` para a pasta privada do `cloudflared`, substitua
o UUID, o caminho de credenciais e o domínio. Nunca envie o JSON de credenciais
do túnel ao GitHub.

## 2. Proteger com Access

Antes de compartilhar a URL:

1. abra **Access > Applications**;
2. crie uma aplicação **Self-hosted** para `admin.seudominio.com`;
3. crie uma política `Allow` contendo apenas os e-mails autorizados;
4. use autenticação por código enviado ao e-mail ou seu provedor de identidade;
5. mantenha a duração da sessão curta para administradores compartilhados.

Teste em uma janela anônima. A ordem correta é:

1. Cloudflare Access solicita a identidade;
2. o painel solicita `PANEL_ADMIN_TOKEN`;
3. somente então os controles aparecem.

## 3. O que não fazer

- Não mude a publicação do painel de `127.0.0.1` para `0.0.0.0` sem necessidade.
- Não exponha a porta 8080 no roteador.
- Não coloque o token no endereço, no HTML ou no repositório.
- Não use uma política Access que permita qualquer e-mail.
- Não tente cadastrar UDP 19132 como serviço HTTP do Tunnel.

## 4. Revogar alguém

Remova o e-mail da política do Access. Se a pessoa também souber o token local,
gere um novo `PANEL_ADMIN_TOKEN` no `.env` e recrie o painel:

```powershell
docker compose up -d --force-recreate panel
```

As sessões antigas deixam de ser válidas porque são assinadas pelo próprio
token.

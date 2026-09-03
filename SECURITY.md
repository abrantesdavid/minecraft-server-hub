# Segurança

## Modelo de exposição

- A porta do painel é publicada apenas em `127.0.0.1`.
- O painel deve ser disponibilizado externamente somente por um Cloudflare
  Tunnel protegido com Cloudflare Access.
- O token administrativo continua obrigatório mesmo atrás do Access.
- O painel não recebe o socket Docker. Dois proxies separados liberam somente
  leitura de contêineres e as ações de iniciar, parar e reiniciar.
- O console usa a porta SSH interna do gerenciador do servidor Bedrock; ela não
  é publicada no computador hospedeiro.

## Segredos

Nunca envie o arquivo `.env`, tokens do Cloudflare, credenciais de túnel,
mundos ou backups ao GitHub. Esses caminhos estão ignorados pelo Git.

Se um segredo for publicado, revogue-o antes de simplesmente apagar o commit.
Depois gere novos valores executando novamente o script de configuração.

## Relato responsável

Abra um GitHub Security Advisory privado no repositório, em vez de publicar
uma issue contendo detalhes exploráveis ou credenciais.

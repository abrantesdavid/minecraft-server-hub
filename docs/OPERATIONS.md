# Operação, atualização e recuperação

## Atualização automática

O contêiner usa `VERSION=LATEST`. Em cada inicialização, a imagem consulta a
versão Bedrock estável atual e atualiza os binários sem apagar o mundo.

O painel reinicia o servidor diariamente no horário `AUTO_UPDATE_TIME`. O fuso
é definido por `TZ`. Para desativar, deixe o valor vazio e recrie o painel:

```bash
docker compose up -d --force-recreate panel
```

Para atualizar também as imagens Docker e o código do painel:

```powershell
.\scripts\update.ps1
```

ou:

```bash
./scripts/update.sh
```

## Mundo e cópias

O mundo fica em `data/worlds/LEVEL_NAME`. O download pelo painel executa:

1. `save hold` quando o servidor está ligado;
2. espera a gravação estabilizar e consulta `save query`;
3. cria um ZIP com extensão `.mcworld`;
4. executa `save resume` mesmo quando a compactação falha;
5. apaga a cópia temporária após a transferência.

Para uma cópia offline completa, desligue pelo painel e copie a pasta `data`.
Essa cópia também preserva listas, propriedades e packs que venham a ser
adicionados no futuro.

## Recuperar um `.mcworld`

1. Desligue o servidor.
2. Guarde uma cópia da pasta `data` atual.
3. Extraia o `.mcworld` como ZIP.
4. Coloque seu conteúdo em `data/worlds/` usando exatamente o nome definido em
   `LEVEL_NAME`.
5. Ligue o servidor e acompanhe o console.

Não faça a substituição enquanto o servidor estiver gravando.

## Diagnóstico automatizado

No Windows:

```powershell
.\scripts\doctor.ps1
```

No Linux/macOS:

```bash
./scripts/doctor.sh
```

O diagnóstico verifica Docker, Compose, sintaxe da configuração, estado dos
serviços e as últimas linhas dos logs.

## Comandos úteis

```bash
docker compose ps
docker compose logs -f bedrock
docker compose logs -f panel
docker compose restart panel
docker compose down
docker compose up -d
```

Evite `docker compose down -v`, `docker system prune --volumes` e qualquer
remoção da pasta `data` sem uma cópia confirmada.

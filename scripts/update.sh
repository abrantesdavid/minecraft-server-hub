#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
docker compose pull
docker compose build --pull panel
docker compose up -d --remove-orphans
docker image prune -f --filter "until=168h"
echo "Imagens atualizadas. O Bedrock verificara a versao mais recente ao iniciar."

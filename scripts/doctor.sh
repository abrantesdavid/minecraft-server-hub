#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

echo "== Docker =="
docker version --format 'Engine: {{.Server.Version}}'
docker compose version

echo "== Configuracao =="
test -f .env || { echo ".env ausente: execute scripts/setup.sh" >&2; exit 1; }
docker compose config --quiet

echo "== Servicos =="
docker compose ps

echo "== Ultimas linhas =="
docker compose logs --tail=20 bedrock panel

#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker nao foi encontrado. Instale Docker Engine/Desktop e tente novamente." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "O plugin Docker Compose nao foi encontrado." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    panel_token=$(openssl rand -hex 32)
    console_password=$(openssl rand -hex 24)
  else
    panel_token=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
    console_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  fi
  sed -i.bak "s/^PANEL_ADMIN_TOKEN=.*/PANEL_ADMIN_TOKEN=$panel_token/" .env
  sed -i.bak "s/^CONSOLE_PASSWORD=.*/CONSOLE_PASSWORD=$console_password/" .env
  rm -f .env.bak
  echo "Arquivo .env criado com segredos aleatorios."
fi

if grep -q '^EULA=FALSE' .env; then
  printf "Digite ACEITO se voce leu e aceita a EULA do Minecraft (https://www.minecraft.net/eula): "
  read -r answer
  if [ "$answer" != "ACEITO" ]; then
    echo "Instalacao cancelada: a EULA precisa ser aceita explicitamente." >&2
    exit 1
  fi
  sed -i.bak 's/^EULA=FALSE/EULA=TRUE/' .env
  rm -f .env.bak
fi

mkdir -p data
docker compose pull
docker compose build --pull panel
docker compose up -d

panel_port=$(sed -n 's/^PANEL_PORT=//p' .env | tail -n 1)
panel_port=${panel_port:-8080}
echo "Servidor iniciado. Painel local: http://127.0.0.1:$panel_port"
echo "O token de entrada esta em .env e nunca deve ser enviado ao GitHub."

#!/usr/bin/env bash
# Atualiza a stack com as imagens mais recentes do GHCR. Idempotente: se nada
# mudou, `up -d` não recria nenhum container.
# Cron (na VM):  */5 * * * * /home/ubuntu/Glucore/backend/deploy/update.sh >> /var/log/glucore-update.log 2>&1
#
# Fixar uma versão (rollback): defina TAG=<sha> em deploy/.env.prod e rode este
# script. O cron passa a manter essa tag até você remover a linha.
set -euo pipefail

cd "$(dirname "$0")/.."
exec 9>/tmp/glucore-update.lock
flock -n 9 || { echo "$(date -Is) outra atualização em andamento"; exit 0; }

dc() { docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod "$@"; }

dc pull --quiet
# `up -d` só recria os serviços cuja imagem mudou; sem novidade, não faz nada.
out=$(dc up -d --remove-orphans 2>&1)
if echo "$out" | grep -qE 'Recreat|Creat|Start'; then
  echo "$(date -Is) atualizado"
  echo "$out"
  docker image prune -f >/dev/null
fi

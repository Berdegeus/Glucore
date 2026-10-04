#!/usr/bin/env bash
# Backup diário das duas bases, criptografado com openssl (AES-256).
# Cron (na VM):  0 3 * * * /home/ubuntu/Glucore/backend/deploy/backup.sh >> /var/log/glucore-backup.log 2>&1
#
# Requer BACKUP_PASSPHRASE no ambiente (ou em deploy/.env.backup). Para enviar
# a cópia para fora da VM, defina BACKUP_UPLOAD_CMD, por exemplo:
#   BACKUP_UPLOAD_CMD='oci os object put -bn glucore-backups --file'
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f deploy/.env.backup ] && set -a && . deploy/.env.backup && set +a
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"

DEST="${BACKUP_DIR:-$HOME/glucore-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

for db in glucore_dev glucore_auth_dev; do
  out="$DEST/${db}-${STAMP}.sql.gz.enc"
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod \
    exec -T postgres pg_dump -U glucore --no-owner "$db" \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$out"
  echo "ok: $out"
  if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
    $BACKUP_UPLOAD_CMD "$out"
  fi
done

find "$DEST" -name '*.sql.gz.enc' -mtime +"$KEEP_DAYS" -delete

# Restaurar:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in ARQUIVO.sql.gz.enc | gunzip | \
#     docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec -T postgres psql -U glucore NOME_DA_BASE

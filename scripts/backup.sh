#!/usr/bin/env bash
# Backup diário da base de dados e dos ficheiros (fotografias, vídeos e miniaturas), com retenção de 30 dias.
# Os backups têm dados pessoais (fotografias e vídeos dos convidados): só o dono os pode ler.
# Com BACKUP_AGE_RECIPIENT definido (chave pública do age), ficam também cifrados; a chave privada
# deve ficar fora deste servidor.
set -euo pipefail
umask 077
COMPOSE="${COMPOSE:-docker compose -f compose.yml -f compose.prod.yml}"
mkdir -p backups
chmod 700 backups
stamp="$(date +%F-%H%M)"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-$(grep -E '^BACKUP_AGE_RECIPIENT=' .env 2>/dev/null | cut -d= -f2- || true)}"

encrypt() {
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then age -r "$BACKUP_AGE_RECIPIENT"; else cat; fi
}
ext=""
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null || { echo "BACKUP_AGE_RECIPIENT definido mas o age não está instalado." >&2; exit 1; }
  ext=".age"
fi

$COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip | encrypt > "backups/db-$stamp.sql.gz$ext"
$COMPOSE exec -T app tar czf - -C storage/app . | encrypt > "backups/files-$stamp.tar.gz$ext"

find backups \( -name 'db-*.sql.gz*' -o -name 'files-*.tar.gz*' \) -mtime +30 -delete
echo "backups/db-$stamp.sql.gz$ext"
echo "backups/files-$stamp.tar.gz$ext"

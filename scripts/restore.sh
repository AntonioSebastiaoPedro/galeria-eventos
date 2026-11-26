#!/usr/bin/env bash
# Uso: restore.sh backups/db-AAAA-MM-DD-HHMM.sql.gz     (base de dados)
#      restore.sh backups/files-AAAA-MM-DD-HHMM.tar.gz  (ficheiros)
# Backups cifrados (.age): AGE_IDENTITY=/caminho/da/chave-privada restore.sh backups/db-….sql.gz.age
set -euo pipefail
COMPOSE="${COMPOSE:-docker compose -f compose.yml -f compose.prod.yml}"

read_backup() {
  case "$1" in
    *.age) age -d -i "${AGE_IDENTITY:?Defina AGE_IDENTITY com a chave privada do age}" "$1" ;;
    *) cat "$1" ;;
  esac
}

case "${1%.age}" in
  *.sql.gz) read_backup "$1" | gunzip -c | $COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' ;;
  *.tar.gz) read_backup "$1" | $COMPOSE exec -T app tar xzf - -C storage/app ;;
  *) echo "Ficheiro desconhecido: $1" >&2; exit 1 ;;
esac

#!/usr/bin/env bash
set -euo pipefail
DC="docker compose -f compose.yml -f compose.prod.yml"
# No primeiro deploy ainda não há base de dados para guardar.
if $DC ps --status running --services 2>/dev/null | grep -qx postgres; then ./scripts/backup.sh; fi
$DC up -d --build
# A imagem passou a correr como www-data: os ficheiros antigos do volume podem ter sido criados como root.
$DC exec -T -u root app chown -R www-data:www-data storage/app
$DC exec -T app php artisan migrate --force
$DC exec -T app php artisan optimize:clear
$DC exec -T app php artisan optimize
$DC exec -T app php artisan queue:restart
$DC exec -T app php artisan reverb:restart

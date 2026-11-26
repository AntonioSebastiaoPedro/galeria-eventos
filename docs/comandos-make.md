# Comandos do Makefile e deploy

O `Makefile` junta os comandos do dia a dia (os mesmos do `unia-presence`). Há dois ambientes, com compose diferentes:

| Ambiente | Compose | Onde se usa |
|---|---|---|
| Desenvolvimento | `compose.yml` + `compose.dev.yml` | máquina local |
| Produção | `compose.yml` + `compose.prod.yml` | VPS |

Os alvos `up`, `down`, `logs`, `artisan`, `composer`, `npm`, `shell`, `test`, `lint` e `fresh` usam o compose de **desenvolvimento**. Na VPS só se usam `prod-artisan`, `deploy`, `backup` e `restore`.

## Portas (desenvolvimento)

Diferentes das do `unia-presence`, para os dois projectos poderem correr ao mesmo tempo. Definidas no `.env`.

| Serviço | Variável | Porta | Endereço |
|---|---|---|---|
| Interface (Vite) | `VITE_HOST_PORT` | 25373 | http://localhost:25373 |
| nginx (API) | `HTTP_PORT` | 29680 | http://localhost:29680 |
| nginx (HTTPS, reservado) | `HTTPS_PORT` | 29643 | |
| PostgreSQL | `DB_HOST_PORT` | 25639 | `localhost:25639` |
| Redis | `REDIS_HOST_PORT` | 26589 | |
| Reverb | `REVERB_HOST_PORT` | 29685 | (o navegador usa o nginx, `/app`) |
| Mailpit (SMTP) | `MAILPIT_SMTP_PORT` | 21225 | |
| Mailpit (caixa de correio) | `MAILPIT_UI_PORT` | 29125 | http://localhost:29125 |

Para comparação, o `unia-presence` usa 28480, 28443, 25439, 26389, 28485, 25173, 21025 e 28025.

## Desenvolvimento

| Comando | O que faz |
|---|---|
| `make setup` | Primeira vez: cria o `.env` (com `APP_KEY`), sobe os contentores, acerta o dono do volume de ficheiros, instala o Composer, corre `migrate --seed` e cria a base de testes `galeria_eventos_test` |
| `make up` / `make down` | Sobe / pára os contentores |
| `make logs` | Segue os logs |
| `make artisan cmd="..."` | Corre um comando do artisan no contentor `app` |
| `make composer cmd="..."` | Corre o Composer no contentor `app` |
| `make npm cmd="..."` | Corre o npm no contentor `node` |
| `make shell` | Abre um terminal no contentor `app` |
| `make test` | Corre os testes do backend |
| `make lint` | Pint (PHP), oxlint e verificação de tipos (TypeScript) |
| `make fresh` | **Apaga a base de dados** e recria-a com `migrate:fresh --seed` |

Depois do `make setup`, abrir http://localhost:25373. Contas de demonstração (senha `password`):

- `organizador@galeria.local` — organizador, com o evento "Aniversário da Dicla" (público, plano Premium, 12 fotografias);
- `admin@galeria.local` — administração.

Os e-mails (recuperação de senha) chegam ao Mailpit: http://localhost:29125.

Exemplos:

```bash
make artisan cmd="migrate"
make artisan cmd="queue:failed"
make composer cmd="require vendor/pacote"
make npm cmd="run build"
```

### Fila e processamento

O contentor `queue` gera as miniaturas, processa os vídeos, cria os ZIP e envia os avisos em tempo real. Se as fotografias ficarem em "A preparar…", ver `make logs` (serviço `queue`). Depois de alterar código de jobs, reiniciar o worker: `make artisan cmd="queue:restart"`.

## Produção (na VPS)

| Comando | O que faz |
|---|---|
| `make deploy` | Backup, build, `up -d`, dono do volume, migrações, `optimize:clear`, `optimize`, reinício da fila e do Reverb |
| `make prod-artisan cmd="..."` | Corre um comando do artisan em produção |
| `make backup` | Cria `backups/db-<data>.sql.gz` e `backups/files-<data>.tar.gz` (fotografias, vídeos, miniaturas); apaga os com mais de 30 dias |
| `make restore file=<...>` | Restaura um backup (ver `scripts/restore.sh`) |

O `DatabaseSeeder` **não** deve correr em produção: cria contas de demonstração com a senha `password`.

### Primeiro deploy

```bash
cp .env.production.example .env        # preencher os campos em branco (APP_KEY, DB_PASSWORD, REVERB_APP_SECRET, RESEND_API_KEY…)
make deploy
make prod-artisan cmd="app:create-superadmin o.teu@email.ao 'O Teu Nome'"
```

Depois, acrescentar o bloco de `docker/caddy/Caddyfile` ao Caddy da VPS (domínio e porta `HTTP_PORT`) e recarregá-lo (`sudo systemctl reload caddy`). O bloco já aceita pedidos até 320 MB (vídeos).

`COMPOSE_PROJECT_NAME=galeria` separa os contentores e volumes dos de outros projectos na mesma VPS.

### Deploys seguintes

```bash
git pull
make deploy
```

### Backups

`scripts/backup.sh` guarda a base de dados e o volume de ficheiros. Com `BACKUP_AGE_RECIPIENT` (chave pública do [age](https://age-encryption.org)) no `.env`, os backups ficam cifrados; a chave privada deve ficar fora do servidor. Agendar no cron da VPS, por exemplo:

```
30 3 * * * cd /caminho/galeria-eventos && make backup >> backups/backup.log 2>&1
```

Atenção ao espaço: os vídeos ocupam muito. Acompanhar o espaço usado em `/admin`.

## Notas

- `cmd="..."` leva o comando todo entre aspas. Para argumentos com espaços, usar aspas simples dentro das duplas.
- Os comandos interactivos (como o pedido de senha do `app:create-superadmin`) funcionam, porque o terminal é passado ao contentor.

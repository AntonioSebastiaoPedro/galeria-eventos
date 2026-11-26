DC_DEV = docker compose -f compose.yml -f compose.dev.yml
DC_PROD = docker compose -f compose.yml -f compose.prod.yml

.PHONY: prod-artisan setup lint up down logs artisan composer npm shell test fresh backup restore deploy

setup:
	@test -f .env || cp .env.example .env
	@grep -q '^APP_KEY=base64' .env || sed -i "s#^APP_KEY=.*#APP_KEY=base64:$$(openssl rand -base64 32)#" .env
	@cp .env backend/.env
	$(DC_DEV) up -d --build
	@# O volume storage (fotografias, miniaturas, ZIP) nasce com o dono da imagem (www-data); em desenvolvimento o PHP corre com o uid do host.
	$(DC_DEV) exec -T -u root app chown -R $$(id -u):$$(id -g) storage/app
	$(DC_DEV) exec app composer install
	$(DC_DEV) exec app php artisan migrate --seed
	@$(DC_DEV) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname = '"'"'galeria_eventos_test'"'"'" | grep -q 1 || createdb -U "$$POSTGRES_USER" galeria_eventos_test'

up:
	$(DC_DEV) up -d
down:
	$(DC_DEV) down
logs:
	$(DC_DEV) logs -f
artisan:
	$(DC_DEV) exec app php artisan $(cmd)
prod-artisan:
	$(DC_PROD) exec app php artisan $(cmd)
composer:
	$(DC_DEV) exec app composer $(cmd)
npm:
	$(DC_DEV) exec node npm $(cmd)
shell:
	$(DC_DEV) exec app sh
test:
	$(DC_DEV) exec app php artisan test
lint:
	$(DC_DEV) exec app vendor/bin/pint --test
	$(DC_DEV) exec node npm run lint
	$(DC_DEV) exec node npx tsc -b
fresh:
	$(DC_DEV) exec app php artisan migrate:fresh --seed
backup:
	./scripts/backup.sh
restore:
	./scripts/restore.sh $(file)
deploy:
	./scripts/deploy.sh

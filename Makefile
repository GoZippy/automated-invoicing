.PHONY: up down logs ps db-init psql status

up:
	docker compose up -d
	docker compose ps

down:
	docker compose down

logs:
	docker compose logs -f | cat

ps:
	docker compose ps

status:
	docker compose ps

psql:
	PGPASSWORD=$${POSTGRES_PASSWORD:-invoicerpw} psql -h $${POSTGRES_HOST:-localhost} -p $${POSTGRES_PORT:-5432} -U $${POSTGRES_USER:-invoicer} -d $${POSTGRES_DB:-invoicing}

db-init:
	bash scripts/wait-for-postgres.sh
	PGPASSWORD=$${POSTGRES_PASSWORD:-invoicerpw} psql -h $${POSTGRES_HOST:-localhost} -p $${POSTGRES_PORT:-5432} -U $${POSTGRES_USER:-invoicer} -d $${POSTGRES_DB:-invoicing} -f db/schema.sql
SHELL := /usr/bin/bash

.PHONY: help up down logs ps psql init-db seed reset-db health

help:
	@echo "Targets: up, down, logs, ps, psql, init-db, seed, reset-db, health"

up:
	docker compose up -d
	docker compose ps
	docker compose logs -f --tail=50 | cat

down:
	docker compose down

logs:
	docker compose logs -f --tail=200 | cat

ps:
	docker compose ps

psql:
	docker compose exec -it postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

init-db:
	./scripts/init_db.sh

seed:
	./scripts/seed_db.sh

reset-db: down
	docker compose down -v
	docker compose up -d postgres
	./scripts/init_db.sh
	./scripts/seed_db.sh

health:
	./scripts/healthcheck.sh

mark-overdue:
	./scripts/mark_overdue.sh

export-unpaid:
	./scripts/export_unpaid_invoices.sh

test-webhook:
	./scripts/test_webhook.sh
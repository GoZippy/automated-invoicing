#!/usr/bin/env bash
set -euo pipefail

set +e
PG_OK=$(docker compose exec -T postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} >/dev/null 2>&1; echo $?)
N8N_OK=$(curl -fsS http://localhost:${N8N_PORT:-5678}/healthz >/dev/null 2>&1; echo $?)
set -e

if [ "$PG_OK" -eq 0 ]; then echo "Postgres: OK"; else echo "Postgres: FAIL"; fi
if [ "$N8N_OK" -eq 0 ]; then echo "n8n: OK"; else echo "n8n: FAIL"; fi
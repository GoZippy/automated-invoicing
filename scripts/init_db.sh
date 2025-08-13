#!/usr/bin/env bash
set -euo pipefail

if ! docker compose ps postgres >/dev/null 2>&1; then
  echo "Postgres container not found. Run 'make up' first." >&2
  exit 1
fi

PG_CONT=$(docker compose ps -q postgres)
if [ -z "${PG_CONT}" ]; then
  echo "Postgres container not running." >&2
  exit 1
fi

echo "Copying schema to container..."
docker cp docs/DB_SCHEMA.sql "${PG_CONT}:/tmp/DB_SCHEMA.sql"

echo "Applying schema..."
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 -f /tmp/DB_SCHEMA.sql

echo "Schema applied."
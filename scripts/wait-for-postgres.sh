#!/usr/bin/env bash
set -euo pipefail

HOST=${POSTGRES_HOST:-localhost}
PORT=${POSTGRES_PORT:-5432}
USER=${POSTGRES_USER:-invoicer}
DB=${POSTGRES_DB:-invoicing}

retries=30
until PGPASSWORD=${POSTGRES_PASSWORD:-invoicerpw} pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" > /dev/null 2>&1; do
  ((retries--))
  if [ "$retries" -le 0 ]; then
    echo "Postgres not ready in time" >&2
    exit 1
  fi
  echo "Waiting for Postgres at $HOST:$PORT ..."
  sleep 2
done

echo "Postgres is ready"
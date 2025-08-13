#!/usr/bin/env bash
set -euo pipefail

dirname "${BASH_SOURCE[0]}" >/dev/null 2>&1 || true

bash "$(dirname "$0")/wait-for-postgres.sh"

PGPASSWORD=${POSTGRES_PASSWORD:-invoicerpw} psql \
  -h ${POSTGRES_HOST:-localhost} \
  -p ${POSTGRES_PORT:-5432} \
  -U ${POSTGRES_USER:-invoicer} \
  -d ${POSTGRES_DB:-invoicing} \
  -f db/schema.sql

echo "Database initialized"
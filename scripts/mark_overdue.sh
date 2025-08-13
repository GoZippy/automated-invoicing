#!/usr/bin/env bash
set -euo pipefail

docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT public.mark_overdue_invoices();"
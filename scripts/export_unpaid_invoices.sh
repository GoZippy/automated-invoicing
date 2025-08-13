#!/usr/bin/env bash
set -euo pipefail

OUT=${1:-unpaid_invoices.csv}

docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -A -F, -q -c \
  "\copy (SELECT invoice_number, amount, status, due_date FROM public.invoices WHERE status <> 'paid') TO STDOUT WITH CSV HEADER" \
  > "$OUT"

echo "Wrote $OUT"
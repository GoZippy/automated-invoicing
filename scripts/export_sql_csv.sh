#!/usr/bin/env bash
set -euo pipefail

SQL=${1:-}
if [ -z "$SQL" ]; then
  echo "Usage: $0 \"<SQL>\" [output.csv]" >&2
  exit 1
fi
OUT=${2:-export.csv}

docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -A -F, -q -c \
  "\copy ( ${SQL} ) TO STDOUT WITH CSV HEADER" > "$OUT"

echo "Wrote $OUT"
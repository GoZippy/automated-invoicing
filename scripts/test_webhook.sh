#!/usr/bin/env bash
set -euo pipefail

: "${WEBHOOK_URL:?Set WEBHOOK_URL}"
: "${X_API_KEY:-}"

BODY=${1:-'{"query":"Show me unpaid invoices from last month","user_id":"cli","request_id":"req-cli","session_id":"sess-cli"}'}
HMAC_SECRET=${HMAC_SECRET:-}

SIG=""
if [ -n "$HMAC_SECRET" ]; then
  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | awk '{print $2}')
fi

curl -fsSL -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  ${X_API_KEY:+-H "X-Api-Key: $X_API_KEY"} \
  ${SIG:+-H "X-Signature: $SIG"} \
  -d "$BODY" | jq .
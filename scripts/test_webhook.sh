#!/usr/bin/env bash
set -euo pipefail

URL=${WEBHOOK_URL:-http://localhost:5678/webhook/d9fec84b-86f0-4230-9fd4-c1cb392ff8b5}
HEADER_NAME=${WEBHOOK_HEADER_NAME:-X-Auth-Token}
HEADER_VALUE=${WEBHOOK_HEADER_VALUE:-replace-with-secret}

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "$HEADER_NAME: $HEADER_VALUE" \
  -d '{
    "query": "Show me unpaid invoices from last month",
    "user_id": "local-user",
    "request_id": "req-123",
    "session_id": "sess-123"
  }' | jq .
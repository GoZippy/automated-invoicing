# Webhook Guide

Endpoint: `POST /webhook/d9fec84b-86f0-4230-9fd4-c1cb392ff8b5`

Auth: Header auth
- Name: from `.env` or n8n credential (e.g., `X-Auth-Token`)
- Value: secret token

Example curl:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "${WEBHOOK_HEADER_NAME:-X-Auth-Token}: ${WEBHOOK_HEADER_VALUE:-replace-with-secret}" \
  -d @docs/examples/webhook_payload.json \
  http://localhost:${N8N_PORT:-5678}/webhook/d9fec84b-86f0-4230-9fd4-c1cb392ff8b5
```

Response: JSON with results from the Intelligent Invoicing Agent.
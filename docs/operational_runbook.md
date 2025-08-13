# Operational Runbook

## Setup
1. Copy `.env.example` to `.env` and fill values
2. Start services: `make up`
3. Initialize DB: `make db-init`
4. Open n8n: http://localhost:${N8N_PORT}
5. Import `n8n_workflow_intelligent_invoicing.json`
6. Create credentials in n8n: Postgres, OpenAI, Google Drive

## Routine Operations
- Monitor n8n executions page for errors and durations
- Check Postgres health via `docker ps` and logs
- Rotate API keys quarterly; update n8n credentials

## Troubleshooting
- Webhook 401: verify header auth name and value
- DB connection: ensure host `postgres` and correct port from compose network
- Extraction mismatches: see OpenAI prompt rules; inspect `calculation_error` flag
- Drive trigger not firing: permissions or wrong folder id

## Backups
- Nightly pg_dump; retain 14 days
- Export n8n workflow JSON on every change

## Security
- No secrets in git; only via env or n8n credentials vault
- Limit inbound ports to required services
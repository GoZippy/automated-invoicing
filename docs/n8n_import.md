# n8n Import & Configuration

## Import
1. In n8n, go to Workflows → Import from File
2. Select `n8n_workflow_intelligent_invoicing.json`
3. Save and ensure workflow is Inactive until credentials are configured

## Credentials to Create
- Postgres: host `postgres`, port from compose, db, user, pass
- OpenAI: API key
- Google Drive: Service Account JSON; share folder with service account address
- Header Auth for Webhook: header name and token

## Map Credentials to Nodes
- Postgres nodes: select created Postgres account
- OpenAI nodes: select OpenAI account
- Google Drive nodes: select Drive account
- Webhook: assign Header Auth account

## Activate
- Test run manually first, then Activate after success
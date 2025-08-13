### Webhook API

Base: n8n Webhook node (POST)

Headers
- `X-Api-Key: <your-secret>` (example; set via n8n Header Auth credentials)
- `Content-Type: application/json`

Request Body
```json
{
  "query": "Show me unpaid invoices from last month",
  "user_id": "user-123",
  "request_id": "req-456",
  "session_id": "sess-789"
}
```

Responses
- 200 OK with structured payload from the agent
- 4xx/5xx on validation or runtime error

Notes
- Authentication header name/value is configured in n8n Credentials. Keep the secret out of source control.
- See `readme.md` and `docs/WORKFLOW_GUIDE.md` to import and enable the workflow.
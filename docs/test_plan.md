# Test Plan

## Unit-like (Workflow Node-Level)
- Validate OpenAI extraction returns required keys and formats
- Simulate calculation mismatch and ensure flag surfaced
- Verify Postgres tools insert with valid payloads

## Integration
- Drive trigger → download → extraction → agent → DB
- Webhook query → agent → Postgres select → response formatting

## Negative Tests
- Missing invoice number
- Zero/negative quantities
- Mismatched totals
- Unauthorized webhook request

## UAT Scenarios
- Upload 3 invoices with varying statuses
- Query unpaid invoices; verify counts and totals
- Query overdue invoices; verify due-date logic
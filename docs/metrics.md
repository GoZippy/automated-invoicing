# Metrics & Observability

- Track n8n execution durations and error rates per workflow
- Count processed invoices/day via `invoices.created_at`
- Count extraction failures (mismatch) by detecting `calculation_error` in JSON
- Export n8n executions to external log store if needed
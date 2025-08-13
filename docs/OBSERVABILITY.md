### Observability

Logging
- Prefer structured logs in n8n (JSON if possible)
- Include `request_id`, `session_id`, `invoice_number` when available

Metrics
- Track: processed invoices, extraction failures, DB insert failures, query latency

Alerts
- Alert on extraction failure rate > 5% over 15m
- Alert on DB insert error spikes
- Alert on webhook 5xx rate

Dashboards
- Build panels for throughput, errors, latency
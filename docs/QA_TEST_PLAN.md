### QA Test Plan

Functional
- Webhook auth: reject missing or invalid key
- Query agent: unpaid/overdue/paid filters, date ranges, summaries
- Image extraction: parse 3+ invoice formats, verify totals and dates
- DB insert: invoice + items transactional, duplicate protection

Negative
- Missing required fields
- Mismatched totals between items and invoice
- Ambiguous dates (format variance)

Performance
- Process 50 invoices in succession without errors
- Query latency under 2s for typical filters

Observability
- Healthcheck endpoints reachable
- Errors produce alerts
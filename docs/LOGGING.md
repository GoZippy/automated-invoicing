### Structured Logging

- Fields
  - `event`: extraction|insert|query
  - `request_id`, `session_id`
  - `invoice_number`
  - `status`: success|error
  - `duration_ms`

- Example (JSON)
```json
{"event":"insert","invoice_number":"INV-2024-001","status":"success","duration_ms":142}
```
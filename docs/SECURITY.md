### Security Guidance

- Authentication
  - Enforce header auth at the Webhook node (rotate regularly)
  - Prefer HMAC signatures for request validation
- Secrets
  - Keep secrets out of source control; use env vars or secret stores
  - Rotate keys every 90 days
- Database
  - Use least-privilege DB users
  - Encrypt disks/backups
- PII/Data
  - Minimize PII retained in `messages`
  - Set data retention for invoices and messages
  - Provide export/delete pathways
- Audit/Logging
  - Log access to webhook and critical operations
  - Retain logs per compliance needs
# Security & Compliance Checklist

## Data Protection
- [x] Use `.env` files and Docker secrets to keep credentials out of source control.
- [ ] Enable SSL/TLS termination in production (use Caddy or Nginx reverse proxy).
- [ ] Encrypt database at rest (cloud provider or self-managed with disk encryption).
- [ ] Encrypt S3/Drive storage buckets.

## Access Control
- [ ] Implement API key header for `/chat` and `/upload-invoice` endpoints.
- [ ] Add rate limiting middleware (e.g. `slowapi`).
- [ ] Role-based permissions in Postgres (separate app vs readonly roles).

## Vulnerability Management
- [ ] Dependabot alerts enabled.
- [ ] Weekly `pip-audit` scan in CI.
- [ ] Docker images rebuilt monthly with latest patches.

## Compliance
- [ ] GDPR data export & delete endpoints.
- [ ] Privacy policy and terms of service drafted.
- [ ] Maintain audit log in Postgres (`messages.metadata`).
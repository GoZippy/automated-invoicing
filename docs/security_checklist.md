# Security Checklist

- [ ] Secrets only via env or n8n credentials; never commit keys
- [ ] Webhook requires header auth; rotate token periodically
- [ ] Limit network exposure to required ports
- [ ] Use least-privilege DB user (DML only)
- [ ] Enable n8n user auth; restrict admin access
- [ ] PII handling: addresses stored securely; backups encrypted
- [ ] Regular dependency and image updates
- [ ] Audit logs enabled and retained
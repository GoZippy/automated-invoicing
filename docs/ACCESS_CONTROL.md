### Access Controls

- n8n UI requires basic auth; restrict IP/CIDR where possible
- Webhook requires header auth and HMAC signature
- DB access via dedicated user with limited privileges
- Principle of least privilege for all roles
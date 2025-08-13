### HMAC Webhook Validation

- Set `HMAC_SECRET` in environment of n8n
- Client should compute `hex(hmac_sha256(secret, raw_body))` and send in `X-Signature` header

Client example (bash)
```bash
body='{"query":"Show unpaid"}'
SIG=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$HMAC_SECRET" -hex | awk '{print $2}')
curl -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -H "X-Signature: $SIG" -d "$body"
```
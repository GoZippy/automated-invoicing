### n8n Hardening Steps

1) Insert Invoice Line Items
- Add a Function node ("Parse Line Items") after the OpenAI Vision → Set(JSON as query)
- Code example:
```javascript
const data = JSON.parse(item.query);
const invoiceNumber = data.invoice_details.invoice_number;
return data.line_items.map(li => ({
  json: {
    invoice_number: invoiceNumber,
    item_description: li.item_description,
    quantity: li.quantity,
    unit_price: li.unit_price,
    amount: li.amount,
  }
}));
```
- Connect this to a Postgres node (Insert) for `invoice_line_items` with direct field mapping.

2) Transactional Insert (invoice + items)
- Use a Code node or Postgres transaction block:
```sql
BEGIN;
-- insert invoice
-- insert items
COMMIT;
```
- Or use a Function node to call Postgres via API and wrap statements.

3) Duplicate Detection
- Before insert, add a Postgres SELECT to check existing `invoice_number` and short-circuit if found.
- DB unique constraint already protects against duplicates.

4) HMAC Validation for Webhook
- Add a Function node before processing to verify signature header:
```javascript
const crypto = require('crypto');
const secret = $env.HMAC_SECRET;
const body = JSON.stringify($json.body || {});
const sent = $headers['x-signature'] || '';
const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
if (hmac !== sent) { throw new Error('Invalid signature'); }
return items;
```

5) Error Routing
- On error paths, send to Slack via HTTP Request node using `SLACK_WEBHOOK_URL`.
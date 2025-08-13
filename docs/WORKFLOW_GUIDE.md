### Workflow Guide (n8n)

1) Import Workflow
- In n8n, import `Intelligent_Invoicing final.json`

2) Configure Credentials
- Postgres (host, db, user, password, ssl as needed)
- OpenAI API key
- Google Drive (Service Account)
- Header Auth for the Webhook

3) Set Node Parameters
- Webhook path and authentication
- Google Drive folder to watch
- Postgres tables: `invoices`, `invoice_line_items`, `messages`

4) Activate
- Test with a sample request (see `docs/API.md`)
- Verify DB inserts and agent responses

5) Recommended Hardening
- Add `invoice_line_items` insert node
- Make inserts transactional (invoice + items)
- Add duplicate protection by `invoice_number`
### Workflow Mapping & Gaps

Current Nodes (key)
- Webhook → Prep Input Fields → Agent → Prep Output → Respond to Webhook
- Google Drive Trigger → Google Drive Download → OpenAI (Vision) → Set(JSON as query) → Invoice Details Processing Agent
- Tools: Get Invoices (Postgres), Get Line Items (Postgres), Add Invoice Details (Postgres), Postgres Chat Memory

Gaps
- Missing insert tool for `invoice_line_items`
- No transactional grouping of invoice + items
- Duplicate detection by `invoice_number` not enforced in workflow
- Extraction includes `issue_date`/`due_date` but current insert mapping omits them

Recommendations
- Add Postgres tool node for `invoice_line_items`
- Wrap inserts in one transaction (Function or Code node)
- Add a pre-insert check for existing `invoice_number`
- Extend mapping to include `issue_date`, `due_date`

Alternative Approach
- Use Postgres function `public.insert_invoice_with_items(jsonb)` to perform upsert + items insert atomically
- Map the JSON from extraction directly into this function via Postgres node (Execute Query)
### Intelligent Invoicing — Milestones and Tasks

Status legend: [x] Done, [ ] Pending

Links: [Launch Checklist](./LAUNCH_CHECKLIST.md) • [API](./API.md) • [Workflow Guide](./WORKFLOW_GUIDE.md) • [Deployment](./DEPLOYMENT.md) • [Security](./SECURITY.md) • [QA Test Plan](./QA_TEST_PLAN.md) • [Runbook](./RUNBOOK.md) • [Workflow Mapping](./WORKFLOW_MAPPING.md) • [DB Schema](./DB_SCHEMA.sql)

### Milestone 0 — Planning & Repo Bootstrapping
- [x] Create `docs/` structure and author end-to-end plan
- [x] Add `.env.example` with all required variables
- [x] Add `docker-compose.yml` for Postgres + n8n
- [x] Add `Makefile` for common workflows
- [x] Add DB bootstrap scripts (`scripts/init_db.sh`, `scripts/seed_db.sh`)
- [x] Add healthcheck script for services
- [x] Update `readme.md` with Quickstart

### Milestone 1 — Database & Data Integrity
- [x] Define canonical schema for `invoices`, `invoice_line_items`, `messages` (see `docs/DB_SCHEMA.sql`)
- [x] Add sample seed data (see `docs/SEED_SAMPLE_INVOICE.sql`)
- [x] Add constraints for currency precision alignment in line items
- [x] Add nightly job for automatic overdue status updates
- [x] Add migration/versioning approach notes

### Milestone 2 — Workflow & Data Pipeline Hardening
- [x] Align extraction JSON fields with DB (ensure `issue_date`, `due_date` handled)
- [ ] Add Postgres tool to insert `invoice_line_items`
- [ ] Ensure transactional insert (invoice + items all-or-nothing)
- [ ] Add duplicate detection by `invoice_number`
- [ ] Enforce validation parity between extraction and DB (amount sums, qty > 0, etc.)
- [ ] Error routing to alert channel (Slack/Email)

### Milestone 3 — Query Agent & Retrieval UX
- [ ] Enhance default responses: summaries, totals, pagination
- [ ] Add pre-built filters (unpaid, overdue, vendor, date ranges)
- [ ] Add CSV/Excel export for query results
- [ ] Add guardrails for ambiguous queries with clarifying follow-ups

### Milestone 4 — Security & Compliance
- [ ] Webhook request validation (HMAC signature) before processing
- [ ] Secrets management and rotation policy
- [ ] PII handling and data retention policy
- [ ] Access controls for UI and API endpoints

### Milestone 5 — Observability & Ops
- [x] Add basic healthcheck script
- [x] Structured logging guidance for workflow nodes
- [x] Add error budget/SLOs draft
- [x] Add incident response flow

### Milestone 6 — QA, UAT, and Launch
- [x] Draft QA Test Plan
- [x] Draft Launch Checklist
- [x] Populate test fixtures (more real invoice types/brands)
- [ ] Run UAT and signoff
- [ ] Final launch GO/NOGO review

### Notes
- The current n8n workflow imports/exports invoice data, but insertion of `invoice_line_items` is not yet automated. See [Workflow Mapping](./WORKFLOW_MAPPING.md) for gaps and recommendations.

### Next Actions
- Implement `invoice_line_items` insert Postgres node and connect to parsed items
- Add transactional grouping for invoice + items
- Wire Slack error notifications on all failure paths
- Run UAT with expanded seeds
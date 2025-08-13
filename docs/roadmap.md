# Roadmap: Intelligent Invoicing Launch

## Milestone M0: Discovery & Alignment
- Define scope, goals, and success metrics
- Inventory current assets: `readme.md`, `Intelligent_Invoicing final.json`, `sample_invoice.png`
- Clarify assumptions and constraints (self-hosted n8n, Postgres, OpenAI, Google Drive)
- Decide naming and file conventions for workflow import

## Milestone M1: Dev Environment & Infrastructure
- Docker Compose for Postgres and optional PgAdmin
- Environment variables template `.env.example`
- Makefile commands for common tasks
- Scripts: wait-for-Postgres, DB init
- Update `readme.md` with local spin-up instructions

## Milestone M2: Database Schema & Migration
- Design tables: `invoices`, `invoice_line_items`, `messages`
- Write `db/schema.sql` with indexes and constraints
- Migration script `scripts/db_init.sh`
- Seed data script (optional)

## Milestone M3: n8n Workflow Import & Configuration
- Normalize workflow file name: `n8n_workflow_intelligent_invoicing.json`
- Document import steps in n8n UI
- Create credentials in n8n: Postgres, OpenAI, Google Drive
- Map Postgres host to compose service
- Verify node connections and execution order

## Milestone M4: Ingestion & Extraction Pipeline
- Configure Google Drive Trigger to target folder
- Configure Drive download and OpenAI vision extraction
- Validate output JSON against required schema
- Add error paths and logging for extraction failures

## Milestone M5: Persistence Agent & DB Tools
- Configure Agent prompt for validation + SQL prep
- Connect `Add Invoice Details` Postgres tool
- Extend to handle line items insert (new tool for `invoice_line_items`)
- Add transaction semantics (execute inserts atomically)

## Milestone M6: Query Agent & Chat Memory
- Configure Webhook node w/ auth header
- Add Set nodes for `query`, `user_id`, `request_id`, `session_id`
- Configure Postgres Chat Memory to use `messages`
- Tune system prompt for query agent outputs

## Milestone M7: Observability & Ops
- Centralized logs and error notifications
- Health checks for Postgres
- Add runbook for rotating keys and handling failures
- Add metrics (counts, latency) via n8n executions

## Milestone M8: Security & Compliance
- Secrets via env vars; do not commit secrets
- Header auth enforced on webhook
- PII handling policy for addresses
- Data retention windows and backups

## Milestone M9: QA & UAT
- Test plan covering happy-path and failures
- Sample invoices set and validation checklist
- Webhook test script with sample payload
- UAT sign-off checklist

## Milestone M10: Launch
- Final config freeze
- Import final workflow JSON
- Smoke test in prod-like environment
- Handover: runbook + monitoring on-call

---

## Deliverables Checklist by Milestone
- M1: `docker-compose.yml`, `.env.example`, `Makefile`, scripts
- M2: `db/schema.sql`, `scripts/db_init.sh`
- M3: `docs/n8n_import.md`, renamed workflow
- M4: Configured nodes and validation docs
- M5: Postgres tools for both tables; transaction plan
- M6: Webhook secured + memory table wired
- M7: Runbook and health checks
- M8: Security checklist
- M9: Test plan + scripts
- M10: Launch checklist
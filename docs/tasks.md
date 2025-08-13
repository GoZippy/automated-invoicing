# Tasks Backlog (Actionable)

## M1: Dev Environment & Infrastructure
- [x] Create `docker-compose.yml` for Postgres and PgAdmin
- [x] Add `.env.example`
- [x] Add `Makefile` with up/down/init targets
- [x] Add `scripts/wait-for-postgres.sh`
- [x] Add `scripts/db_init.sh`
- [x] Update `readme.md` with local instructions

## M2: Database Schema & Migration
- [x] Write `db/schema.sql` with tables: `invoices`, `invoice_line_items`, `messages`
- [x] Add indexes and constraints
- [ ] Test schema applies cleanly

## M3: n8n Workflow Import & Configuration
- [x] Copy/rename workflow to `n8n_workflow_intelligent_invoicing.json`
- [x] Add `docs/n8n_import.md` with step-by-step import config
- [x] Note credential IDs to be created manually in n8n UI

## M4: Ingestion & Extraction Pipeline
- [ ] Configure Google Drive Trigger folder id via credential UI
- [x] Validate OpenAI vision extraction prompt compliance
- [ ] Add handling for calculation mismatch flag

## M5: Persistence Agent & DB Tools
- [ ] Add Postgres tool for `invoice_line_items` inserts
- [ ] Document transaction approach (two-phase insert)

## M6: Query Agent & Chat Memory
- [x] Ensure `messages` table compatible with memory node
- [x] Webhook header auth doc with example curl

## M7: Observability & Ops
- [x] Add healthcheck to Postgres in Compose
- [x] Add runbook with common failures & resolutions

## M8: Security & Compliance
- [x] Add security checklist and secret handling rules

## M9: QA & UAT
- [x] Create `scripts/test_webhook.sh`
- [x] Add sample payload examples

## M10: Launch
- [ ] Finalize configs and perform smoke tests
- [ ] Handover docs complete
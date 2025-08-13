## Launch Checklist for Intelligent Invoicing

### Milestone 1: Documentation & Planning
- [ ] Create docs folder in repository (done)
- [ ] Draft `launch_tasks.md` with full milestone breakdown (this document)
- [ ] Create high-level architecture diagram (n8n workflow + services)
- [ ] Review and refine feature scope with stakeholders

### Milestone 2: Environment Setup
- [ ] Add Docker Compose stack for:
  - n8n (workflow engine)
  - PostgreSQL (database)
  - Supabase (optional managed Postgres + auth)
  - Optional MinIO/S3 (object storage for invoices)
- [ ] Write `.env.example` with required variables (OPENAI_API_KEY, DATABASE_URL, SUPABASE_URL, etc.)
- [ ] Update README with local setup instructions

### Milestone 3: Database Schema & Migrations
- [ ] Design tables: `users`, `sessions`, `messages`, `invoices`, `invoice_line_items`, `payments`
- [ ] Generate migration scripts (SQL or Prisma/Knex)
- [ ] Seed sample data for development
- [ ] Implement connection pooling & backups

### Milestone 4: n8n Workflow Integration
- [ ] Parameterize credentials IDs using environment variables
- [ ] Validate webhook paths & authentication
- [ ] Configure Postgres Chat Memory node to use new DB URL
- [ ] Test full workflow end-to-end locally

### Milestone 5: AI Model & Extraction
- [ ] Implement invoice extraction node (OpenAI function calling / fine-tuned model)
- [ ] Define JSON schema for extracted fields
- [ ] Handle validation & confidence scoring
- [ ] Write fallback/manual review process

### Milestone 6: Invoice Intake & Storage
- [ ] Choose storage provider (Google Drive, S3, or cloud bucket)
- [ ] Implement watch/trigger node for new uploads
- [ ] Store raw invoice files with metadata
- [ ] Link stored file IDs to DB records

### Milestone 7: API Layer
- [ ] Create REST endpoint for invoice upload
- [ ] Create REST/GraphQL endpoint for conversational queries
- [ ] Add authentication & rate limiting
- [ ] Document API (OpenAPI spec)

### Milestone 8: Frontend Experience
- [ ] Build simple React/Next.js dashboard
- [ ] Implement invoice upload UI with drag & drop
- [ ] Chat interface powered by backend endpoints
- [ ] Display invoice history & status filters

### Milestone 9: Testing & QA
- [ ] Unit tests for DB operations & extraction logic
- [ ] Integration tests for full workflow
- [ ] End-to-end tests for frontend flows
- [ ] Load tests for API scalability

### Milestone 10: Deployment & CI/CD
- [ ] Configure GitHub Actions for lint/test/build pipeline
- [ ] Build production Docker images
- [ ] Provision cloud infra (Render, AWS ECS, DigitalOcean, etc.)
- [ ] Automate migrations & seeding on deploy

### Milestone 11: Security & Compliance
- [ ] Encrypt secrets & sensitive data at rest
- [ ] Implement HTTPS & secure headers
- [ ] Role-based access control for API & DB
- [ ] Conduct vulnerability scan & penetration test

### Milestone 12: Monitoring & Analytics
- [ ] Set up logging (Grafana Loki / ELK)
- [ ] Metrics & dashboards for workflow health
- [ ] Alerts for failures & performance issues
- [ ] Usage analytics & business KPIs

---

Keep this checklist updated as tasks are completed or added.
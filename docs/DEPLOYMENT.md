### Local Deployment (Docker Compose)

Prereqs: Docker, Docker Compose

1) Copy env template
```bash
cp .env.example .env
```

2) Start services
```bash
make up
```

3) Initialize database
```bash
make init-db
make seed
```

4) Access n8n UI
- http://localhost:5678

5) Import the workflow JSON and configure credentials as per `docs/WORKFLOW_GUIDE.md`.

Notes
- Overdue job runs hourly in the `overdue` service; disable or adjust cadence as needed
- You can use `public.insert_invoice_with_items(jsonb)` for atomic inserts from n8n
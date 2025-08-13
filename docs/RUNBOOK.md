### Operations Runbook

- Start/Stop
  - Start: `make up`
  - Stop: `make down`
- Database
  - Init: `make init-db`
  - Seed: `make seed`
  - Connect: `make psql`
- Health
  - `./scripts/healthcheck.sh`
- Common Issues
  - Webhook 401: verify header credential
  - DB failures: check connection env vars, container logs
  - Extraction errors: validate OpenAI key and rate limits
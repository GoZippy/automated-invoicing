# Credentials Guide

## Environment
- Copy `.env.example` → `.env` and customize as needed (local only)
- Do not commit `.env`

## n8n Credentials
- Postgres: host `postgres`, port `5432`, db `invoicing`, user `invoicer`, password from `.env`
- OpenAI: API key
- Google Drive: Service Account JSON; share invoice folder to service account
- Webhook Header Auth: choose header name/value; keep value secret

## Node Mapping
- Postgres nodes: Select Postgres account
- OpenAI nodes: Select OpenAI account
- Google Drive nodes: Select Drive account
- Webhook: Select Header Auth

## Rotation
- Rotate tokens/keys quarterly
- Update n8n credentials and verify test runs
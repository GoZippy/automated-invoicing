# Architecture Overview

- Webhook (n8n) → Set (Prep Input Fields) → Chat Memory (Postgres) → Intelligent Invoicing Agent → Set (Prep Output Fields) → Respond to Webhook
- Google Drive Trigger → Google Drive Download → OpenAI Vision → Set (Edit Fields) → Invoice Details Processing Agent → Postgres Tool(s)
- Postgres stores: `invoices`, `invoice_line_items`, `messages`

## Components
- n8n: Orchestration, agent nodes, webhook
- Postgres: Primary datastore for invoices, line items, and chat memory
- Google Drive: Source of uploaded invoices
- OpenAI: Vision extraction and LLM reasoning

## Data Flow
1. Image arrives in Drive; trigger downloads file
2. OpenAI extracts JSON per enforced schema
3. Agent validates and persists invoice + items
4. Users query via webhook; agent uses memory + Postgres tools to answer

## Tables
- `invoices`: invoice_number (unique), amount, status, address, dates, timestamps
- `invoice_line_items`: invoice_number (FK), description, quantity, unit_price, amount
- `messages`: session_id, user_id, role, message, created_at
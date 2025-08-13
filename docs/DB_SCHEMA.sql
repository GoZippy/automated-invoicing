-- Canonical schema for Intelligent Invoicing

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Messages table (for chat memory)
CREATE TABLE IF NOT EXISTS public.messages (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  user_id      TEXT,
  request_id   TEXT,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content      TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.messages (session_id, created_at);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id              BIGSERIAL PRIMARY KEY,
  invoice_number  TEXT NOT NULL UNIQUE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status          TEXT NOT NULL CHECK (status IN ('pending','paid','overdue')),
  address         TEXT NOT NULL,
  issue_date      DATE,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON public.invoices (status, due_date);

-- Line items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id               BIGSERIAL PRIMARY KEY,
  invoice_number   TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_amount_consistency CHECK (amount = ROUND(quantity * unit_price, 2))
);
CREATE INDEX IF NOT EXISTS idx_items_invoice_number ON public.invoice_line_items (invoice_number);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON public.invoice_line_items;
CREATE TRIGGER trg_invoice_items_updated_at
BEFORE UPDATE ON public.invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Overdue status utility (manual or scheduled)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices() RETURNS VOID AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < CURRENT_DATE;
END; $$ LANGUAGE plpgsql;

-- Validate invoice total matches sum of line items (deferrable constraint)
CREATE OR REPLACE FUNCTION public.check_invoice_total(invoice_number text) RETURNS VOID AS $$
DECLARE
  v_total NUMERIC(12,2);
  v_invoice_amount NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.invoice_line_items
  WHERE invoice_number = check_invoice_total.invoice_number;

  SELECT amount INTO v_invoice_amount
  FROM public.invoices
  WHERE invoice_number = check_invoice_total.invoice_number;

  IF v_invoice_amount IS NULL THEN
    RETURN;
  END IF;

  IF ROUND(v_total, 2) <> ROUND(v_invoice_amount, 2) THEN
    RAISE EXCEPTION 'Invoice % total mismatch: items sum % <> invoice amount %', check_invoice_total.invoice_number, v_total, v_invoice_amount;
  END IF;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.invoice_total_constraint_trigger() RETURNS TRIGGER AS $$
DECLARE
  inv_no TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    inv_no := OLD.invoice_number;
  ELSE
    inv_no := NEW.invoice_number;
  END IF;
  PERFORM public.check_invoice_total(inv_no);
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_items_total_check ON public.invoice_line_items;
CREATE CONSTRAINT TRIGGER trg_invoice_items_total_check
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE PROCEDURE public.invoice_total_constraint_trigger();

DROP TRIGGER IF EXISTS trg_invoices_amount_total_check ON public.invoices;
CREATE CONSTRAINT TRIGGER trg_invoices_amount_total_check
AFTER INSERT OR UPDATE OF amount ON public.invoices
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE PROCEDURE public.invoice_total_constraint_trigger();

-- Insert invoice + items from JSON in one atomic function
CREATE OR REPLACE FUNCTION public.insert_invoice_with_items(p_invoice JSONB) RETURNS VOID AS $$
DECLARE
  det JSONB := p_invoice -> 'invoice_details';
  l_items JSONB := p_invoice -> 'line_items';
BEGIN
  -- Upsert invoice
  INSERT INTO public.invoices (invoice_number, amount, status, address, issue_date, due_date)
  VALUES (
    det->>'invoice_number',
    (det->>'amount')::NUMERIC,
    det->>'status',
    det->>'address',
    NULLIF(det->>'issue_date','')::DATE,
    NULLIF(det->>'due_date','')::DATE
  )
  ON CONFLICT (invoice_number) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    address = EXCLUDED.address,
    issue_date = EXCLUDED.issue_date,
    due_date = EXCLUDED.due_date,
    updated_at = now();

  -- Insert items (replace existing items for this invoice)
  DELETE FROM public.invoice_line_items WHERE invoice_number = det->>'invoice_number';
  INSERT INTO public.invoice_line_items (invoice_number, item_description, quantity, unit_price, amount)
  SELECT
    det->>'invoice_number',
    li->>'item_description',
    (li->>'quantity')::NUMERIC,
    (li->>'unit_price')::NUMERIC,
    (li->>'amount')::NUMERIC
  FROM jsonb_array_elements(COALESCE(l_items, '[]'::jsonb)) AS li;

  -- Deferred constraint will validate totals at commit time
END; $$ LANGUAGE plpgsql;

-- Convenience views for common filters
CREATE OR REPLACE VIEW public.unpaid_invoices AS
SELECT * FROM public.invoices WHERE status <> 'paid';

CREATE OR REPLACE VIEW public.overdue_invoices AS
SELECT * FROM public.invoices WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < CURRENT_DATE;
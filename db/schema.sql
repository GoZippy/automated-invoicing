-- Database schema for Intelligent Invoicing

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','paid','overdue')),
  address TEXT NOT NULL,
  issue_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL REFERENCES invoices(invoice_number) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_invoice_number ON invoice_line_items(invoice_number);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Transactional insert function for invoice and items
CREATE OR REPLACE FUNCTION insert_invoice_and_items(
  p_invoice_number TEXT,
  p_amount NUMERIC(12,2),
  p_status TEXT,
  p_address TEXT,
  p_issue_date DATE,
  p_due_date DATE,
  p_items JSONB
) RETURNS VOID AS $$
DECLARE
  item JSONB;
  computed_total NUMERIC(12,2) := 0;
BEGIN
  IF p_status NOT IN ('pending','paid','overdue') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  -- Upsert invoice first to satisfy FK
  INSERT INTO invoices (invoice_number, amount, status, address, issue_date, due_date)
  VALUES (p_invoice_number, p_amount, p_status, p_address, p_issue_date, p_due_date)
  ON CONFLICT (invoice_number) DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    address = EXCLUDED.address,
    issue_date = EXCLUDED.issue_date,
    due_date = EXCLUDED.due_date,
    updated_at = NOW();

  -- Clear existing items for this invoice (idempotent behavior)
  DELETE FROM invoice_line_items WHERE invoice_number = p_invoice_number;

  -- Insert items
  FOR item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO invoice_line_items (
      invoice_number,
      item_description,
      quantity,
      unit_price,
      amount
    ) VALUES (
      p_invoice_number,
      (item->>'item_description'),
      (item->>'quantity')::NUMERIC(12,2),
      (item->>'unit_price')::NUMERIC(12,2),
      (item->>'amount')::NUMERIC(12,2)
    );
    computed_total := computed_total + (item->>'amount')::NUMERIC(12,2);
  END LOOP;

  IF computed_total <> p_amount THEN
    RAISE EXCEPTION 'Line items total % does not match invoice amount %', computed_total, p_amount;
  END IF;
END;
$$ LANGUAGE plpgsql;
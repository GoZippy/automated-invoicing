-- Seed sample invoice and items

INSERT INTO public.invoices (invoice_number, amount, status, address, issue_date, due_date)
VALUES ('INV-2024-001', 2500.00, 'pending', '123 Business Ave, Suite 100, Boston, MA 02108', '2024-01-15', '2024-02-14')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO public.invoice_line_items (invoice_number, item_description, quantity, unit_price, amount)
VALUES
  ('INV-2024-001', 'Website Development - Homepage', 1.00, 1500.00, 1500.00),
  ('INV-2024-001', 'UI/UX Design Services', 10.00, 100.00, 1000.00)
ON CONFLICT DO NOTHING;
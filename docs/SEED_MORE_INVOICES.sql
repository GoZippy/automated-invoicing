-- Additional seeds

INSERT INTO public.invoices (invoice_number, amount, status, address, issue_date, due_date)
VALUES ('INV-2024-002', 1800.00, 'pending', '456 Market St, San Francisco, CA 94103', '2024-03-01', '2024-03-31')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO public.invoice_line_items (invoice_number, item_description, quantity, unit_price, amount)
VALUES
  ('INV-2024-002', 'Consulting Hours', 12.00, 150.00, 1800.00)
ON CONFLICT DO NOTHING;

INSERT INTO public.invoices (invoice_number, amount, status, address, issue_date, due_date)
VALUES ('INV-2024-003', 750.00, 'pending', '789 Elm Rd, Austin, TX 73301', '2024-04-05', '2024-05-05')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO public.invoice_line_items (invoice_number, item_description, quantity, unit_price, amount)
VALUES
  ('INV-2024-003', 'Support Plan - Monthly', 1.00, 750.00, 750.00)
ON CONFLICT DO NOTHING;
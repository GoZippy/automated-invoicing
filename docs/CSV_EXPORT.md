### CSV Export

- Unpaid invoices
```bash
make export-unpaid
```

- Arbitrary SQL to CSV
```bash
./scripts/export_sql_csv.sh "SELECT invoice_number, amount FROM public.invoices WHERE status='pending'"
```
### Reference Queries

Unpaid invoices
```sql
SELECT * FROM public.unpaid_invoices ORDER BY due_date NULLS LAST;
```

Overdue invoices
```sql
SELECT * FROM public.overdue_invoices ORDER BY due_date;
```

By vendor (address contains)
```sql
SELECT * FROM public.invoices WHERE address ILIKE '%Vendor Name%' ORDER BY issue_date DESC;
```

Date range
```sql
SELECT * FROM public.invoices WHERE issue_date BETWEEN $1 AND $2 ORDER BY issue_date;
```

Totals summary
```sql
SELECT COUNT(*) AS num_invoices, SUM(amount) AS total_amount FROM public.invoices WHERE status <> 'paid';
```
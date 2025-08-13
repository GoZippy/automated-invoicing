### Agent Response Templates

Default multi-result format
```
Query understood: <paraphrase>
Summary: <count=N, total_amount=$X>
Page 1/?:
- <Invoice #> — <Date> — <Amount> — <Status>
...
Notes: <overdue flags or anomalies>
```

Pagination
- Default limit 25; include `page` and `page_size` in responses when requested

CSV Export
- When asked, return RFC 4180 CSV in a code block with headers
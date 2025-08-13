# Extraction Validation

Rules:
- Sum(line_items.amount) == invoice_details.amount
- Each amount >= 0, quantity > 0
- invoice_number and address present
- Dates in YYYY-MM-DD; if due missing, set issue + 30 days

Handling Mismatches:
- When `calculation_error` is present or totals mismatch, do not insert
- Return a validation warning in agent response
- Suggest corrected values (recompute amounts) and request confirmation

Implementation in n8n:
- Per current agent prompt, it validates before insert
- Optionally add a Code node to recompute sums and set a `validation_error` flag
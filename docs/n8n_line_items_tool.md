# Adding Line Items Insert Tool in n8n

Goal: Insert each `line_items[]` row into `invoice_line_items`.

Steps:
1. After `Edit Fields`, add an Item Lists → Split Out Items node
   - Source: `={{ JSON.parse($json["query"]).line_items }}`
   - This emits one item per line item
2. Add a Set node to map fields
   - `invoice_number = {{ JSON.parse($json["query"]).invoice_details.invoice_number }}`
   - `item_description = {{$json.item_description}}`
   - `quantity = {{$json.quantity}}`
   - `unit_price = {{$json.unit_price}}`
   - `amount = {{$json.amount}}`
3. Add Postgres Tool (operation: insert) targeting `invoice_line_items`
   - Map columns to fields from the Set node
4. Connect: `Edit Fields` → Split → Set → Postgres Tool
5. Optional: Wrap inserts with a Transaction (n8n workflow or DB function)
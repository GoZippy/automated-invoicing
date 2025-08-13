import json
from ai.extract_invoice import extract
from unittest.mock import patch


def test_extract_minimal():
    raw_text = """
    Invoice Number: 12345
    Invoice Date: 2024-07-01
    Due Date: 2024-07-31
    Vendor: Acme Corp
    Address: 123 Main St
    Total: $100.00 USD
    """
    expected = {
        "invoice_number": "12345",
        "invoice_date": "2024-07-01",
        "due_date": "2024-07-31",
        "vendor_name": "Acme Corp",
        "vendor_address": "123 Main St",
        "total_amount": 100,
        "currency": "USD",
        "line_items": []
    }
    with patch("ai.extract_invoice.openai.chat.completions.create") as mock_chat:
        mock_chat.return_value.choices = [type("obj", (), {"message": type("obj", (), {"content": json.dumps(expected)})})]
        data = extract(raw_text)
        assert data == expected
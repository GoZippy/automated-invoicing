"""
Invoice Extraction Utility

This script provides a CLI for extracting structured invoice data from raw text using the
OpenAI API. The logic can be integrated into an n8n "Run Python" node or executed as a
stand-alone micro-service.

Usage (stand-alone):

    python extract_invoice.py --file invoice.txt

Environment variables required:
    OPENAI_API_KEY
"""

import argparse
import json
import os
from typing import Any, Dict

import openai

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

SCHEMA = {
    "invoice_number": "string",
    "invoice_date": "string (YYYY-MM-DD)",
    "due_date": "string (YYYY-MM-DD, optional)",
    "vendor_name": "string",
    "vendor_address": "string",
    "total_amount": "number",
    "currency": "string (ISO 4217)",
    "line_items": [
        {
            "description": "string",
            "quantity": "number",
            "unit_price": "number",
            "total": "number"
        }
    ]
}

def build_system_prompt() -> str:
    return (
        "You are an invoicing extraction assistant. "
        "Extract the following JSON schema from the provided invoice text. "
        "Only reply with valid JSON that matches this schema, without additional commentary."
    )

def build_user_prompt(raw_text: str) -> str:
    return f"""Here is the OCR-extracted text of an invoice.\n\n```${raw_text}```\n\nReturn JSON with the following structure:\n{json.dumps(SCHEMA, indent=2)}"""

def extract(text: str) -> Dict[str, Any]:
    openai.api_key = os.environ["OPENAI_API_KEY"]
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": build_user_prompt(text)},
    ]
    response = openai.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0,
    )
    content = response.choices[0].message.content.strip()
    return json.loads(content)

def main():
    parser = argparse.ArgumentParser(description="Extract structured invoice data from text")
    parser.add_argument("--file", required=True, help="Path to txt file containing invoice OCR text")
    args = parser.parse_args()

    with open(args.file, "r", encoding="utf-8") as f:
        raw_text = f.read()

    data = extract(raw_text)
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
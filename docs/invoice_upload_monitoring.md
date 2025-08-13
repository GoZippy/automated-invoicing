# Invoice Upload Monitoring Setup

This project uses **Google Drive** as the primary intake location for invoice PDFs or images. Alternatively, S3-compatible storage (MinIO, AWS S3, etc.) can be substituted.

## Google Drive Watch

1. In n8n, add a **Google Drive > Watch** node.
2. Authorise with a Google OAuth credential.
3. Configure the node:
   - *Mode*: "Watch changes in specific folder"
   - *Folder*: Use the `GOOGLE_DRIVE_FOLDER_ID` environment variable
   - *Include files*: PDF, PNG, JPG
   - *Polling Interval*: 5 minutes
4. For each new file:
   - Download the file using **Google Drive > Download** node.
   - Run OCR (Tesseract or Google Vision) to get raw text (future improvement).
   - Pass the text to the **Run Python** node that calls `ai/extract_invoice.py`.
   - Store the JSON result in Postgres (`invoices` and `invoice_line_items`).

## S3 Alternative

1. Use **S3 Trigger** node instead of Google Drive.
2. Set bucket and prefix where invoices are uploaded.
3. Follow the same downstream steps (download, OCR, extraction, DB write).

---

> **Note**: OCR quality heavily influences extraction accuracy. Consider integrating Google Vision or AWS Textract for better results.
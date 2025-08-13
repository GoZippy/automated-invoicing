from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import uuid
import json
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Intelligent Invoicing API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/invoices")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")

@app.post("/upload-invoice")
async def upload_invoice(file: UploadFile = File(...), user_id: str = Form(...)):
    """Receive an invoice file and store it for processing."""
    file_id = f"{uuid.uuid4()}_{file.filename}"
    save_path = os.path.join(UPLOAD_DIR, file_id)
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # TODO: Trigger n8n webhook or insert DB row to start processing workflow.

    return {"success": True, "file_id": file_id}

@app.post("/chat")
async def chat(session_id: str = Form(...), query: str = Form(...), user_id: str = Form(...)):
    """Proxy conversational queries to n8n agent webhook."""
    import httpx
    webhook_url = os.getenv("AGENT_WEBHOOK_URL", "http://localhost:5678/webhook/d9fec84b-86f0-4230-9fd4-c1cb392ff8b5")
    payload = {
        "session_id": session_id,
        "query": query,
        "user_id": user_id,
        "request_id": str(uuid.uuid4())
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(webhook_url, json=payload, headers={"X-API-KEY": os.getenv("API_KEY", "changeme")})
        r.raise_for_status()
        return JSONResponse(r.json())

if __name__ == "__main__":
    uvicorn.run("server.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
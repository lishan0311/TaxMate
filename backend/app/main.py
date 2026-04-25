"""
TaxMate API - Main entry point
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .models.init_db import create_tables
from .routers import documents
from .routers import auth

create_tables()

app = FastAPI(
    title="TaxMate API",
    description="AI agent for Malaysian SME E-Invoice & SST compliance",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "app/static/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(documents.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "service": "TaxMate",
        "version": "0.3.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}

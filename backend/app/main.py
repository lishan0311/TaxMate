"""
TaxMate API - Main entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import documents
from .models.init_db import create_tables

create_tables()

app = FastAPI(
    title="TaxMate API",
    description="AI agent for Malaysian SME E-Invoice & SST compliance",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)

@app.get("/")
def root():
    return {
        "service": "TaxMate",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"} 
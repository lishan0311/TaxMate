"""
Document processing API routes - with auth, review, export, signing, and AI copilots.
"""
import base64
import calendar
import os
import tempfile
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import extract
from sqlalchemy.orm import Session

from ..agents.tax_agent import (
    analyze_monthly_batch,
    answer_accountant_question,
    generate_personalized_email,
    generate_review_brief,
    generate_sst02_field_mapping,
    process_receipt,
)
from ..agents.workflow_orchestrator import run_orchestrator
from ..models.database import get_db
from ..models.document import Document
from ..models.user import User
from ..schemas.document import AgentResult, DocumentReviewRequest, ProcessRequest, ProcessResponse
from ..services.auth_service import decode_access_token
from ..services.email_service import send_approved_report_email
from ..services.ocr_service import perform_ocr

# Batch analysis cache: {user_key: (timestamp, result)}
_batch_cache: dict = {}
_BATCH_CACHE_TTL = 300  # 5 minutes


def _invalidate_batch_cache():
    """Clear all cached batch analysis results."""
    _batch_cache.clear()
from ..services.sst02_filler import apply_signature_to_pdf, generate_sst02_pdf

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "app/static/uploads"


def _get_current_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        return None
    return db.query(User).filter(User.id == payload["sub"]).first()


def _save_to_db(
    db: Session,
    ocr_text: str,
    result: dict,
    filename: str = None,
    file_url: str = None,
    client_id: str = None,
    client_email: str = None,
    company_name: str = None,
) -> Document:
    doc = Document(
        filename=filename,
        ocr_text=ocr_text,
        agent_result=result,
        status="processed" if "error" not in result else "error",
        client_id=client_id,
        client_email=client_email,
        company_name=company_name,
    )

    if hasattr(doc, "file_url"):
        doc.file_url = file_url

    if "error" not in result:
        doc.doc_type = result.get("doc_type")
        doc.supplier_name = result.get("supplier", {}).get("name")
        doc.total_amount = result.get("amount", {}).get("total")
        doc.tax_treatment = result.get("tax_treatment")
        doc.confidence = result.get("confidence")
        doc.risk_count = len(result.get("risk_flags", []))

    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def _resolve_reviewer_name(reviewed_by: str | None, db: Session) -> str | None:
    if not reviewed_by or reviewed_by in ("accountant_demo", "TaxMate AI"):
        return reviewed_by
    user = db.query(User).filter(User.id == reviewed_by).first()
    if user:
        return user.name or user.company_name or user.email.split("@")[0]
    return reviewed_by


def _doc_to_dict(doc: Document, db: Session = None) -> dict:
    reviewer_name = doc.reviewed_by
    if db and doc.reviewed_by:
        reviewer_name = _resolve_reviewer_name(doc.reviewed_by, db)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_url": doc.file_url,
        "doc_type": doc.doc_type,
        "supplier_name": doc.supplier_name,
        "total_amount": doc.total_amount,
        "tax_treatment": doc.tax_treatment,
        "confidence": doc.confidence,
        "risk_count": doc.risk_count,
        "status": doc.status,
        "client_id": doc.client_id,
        "client_email": doc.client_email,
        "company_name": doc.company_name,
        "reviewed_by": reviewer_name,
        "review_action": doc.review_action,
        "signed_by": doc.signed_by,
        "signed_at": str(doc.signed_at) if doc.signed_at else None,
        "created_at": str(doc.created_at),
        "updated_at": str(doc.updated_at),
        "agent_result": doc.agent_result,
    }


def _to_doc_summary(doc: Document) -> dict:
    amount = (doc.agent_result or {}).get("amount", {}) if isinstance(doc.agent_result, dict) else {}
    supplier = (doc.agent_result or {}).get("supplier", {}) if isinstance(doc.agent_result, dict) else {}
    return {
        "id": doc.id,
        "supplier_name": doc.supplier_name,
        "client_id": doc.client_id,
        "date": str(doc.created_at),
        "status": doc.status,
        "tax_treatment": doc.tax_treatment,
        "total_amount": doc.total_amount,
        "subtotal": amount.get("subtotal"),
        "sst_amount": amount.get("sst_amount"),
        "doc_type": doc.doc_type,
        "risk_count": doc.risk_count,
        "confidence": doc.confidence,
        "sst_number": supplier.get("sst_number"),
    }


def _build_b1_rows(docs: list[Document]) -> list[dict]:
    rows: list[dict] = []
    for doc in docs:
        if doc.tax_treatment not in ("output_tax", "input_tax_claimable"):
            continue
        amount = (doc.agent_result or {}).get("amount", {}) if isinstance(doc.agent_result, dict) else {}
        subtotal = amount.get("subtotal")
        sst_amount = amount.get("sst_amount")
        total = doc.total_amount or amount.get("total") or 0.0
        if isinstance(subtotal, (int, float)) and subtotal > 0:
            taxable = float(subtotal)
        elif isinstance(total, (int, float)) and isinstance(sst_amount, (int, float)) and total > sst_amount:
            taxable = float(total - sst_amount)
        else:
            taxable = float(total or 0.0)
        rows.append(
            {
                "description": (doc.supplier_name or "TAXABLE SERVICE").upper(),
                "service_code": "H",
                "taxable_value": round(max(0.0, taxable), 2),
                "tax_treatment": doc.tax_treatment,
            }
        )
    return rows


def _build_sst02_audit_rows(docs: list[Document]) -> list[dict]:
    rows: list[dict] = []
    for doc in docs:
        if doc.tax_treatment not in ("output_tax", "input_tax_claimable"):
            continue
        amount = (doc.agent_result or {}).get("amount", {}) if isinstance(doc.agent_result, dict) else {}
        subtotal = amount.get("subtotal")
        sst_amount = amount.get("sst_amount")
        total = doc.total_amount or amount.get("total") or 0.0
        if isinstance(subtotal, (int, float)) and subtotal > 0:
            taxable = float(subtotal)
            calc_basis = "used AI extracted subtotal"
        elif isinstance(total, (int, float)) and isinstance(sst_amount, (int, float)) and total > sst_amount:
            taxable = float(total - sst_amount)
            calc_basis = "used total - sst_amount"
        else:
            taxable = float(total or 0.0)
            calc_basis = "fallback to total amount"
        rows.append(
            {
                "b1_line": len(rows) + 1,
                "description": (doc.supplier_name or "TAXABLE SERVICE").upper(),
                "service_code": "H",
                "taxable_value": round(max(0.0, taxable), 2),
                "source_document_ids": [doc.id],
                "source_receipts": [
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "supplier_name": doc.supplier_name,
                        "tax_treatment": doc.tax_treatment,
                        "total_amount": doc.total_amount,
                    }
                ],
                "reasoning": f"Mapped as output-tax service (Group H); {calc_basis}.",
                "mapping_method": "deterministic-fallback",
            }
        )
    return rows


def _calculate_totals(docs: list[Document]) -> tuple[float, float, float]:
    """Returns (total_taxable, total_sst_output, total_sst_input_claimable)."""
    total_taxable = 0.0
    total_sst_output = 0.0
    total_sst_input = 0.0
    for doc in docs:
        if doc.tax_treatment not in ("output_tax", "input_tax_claimable"):
            continue
        amount = float(doc.total_amount or 0.0)
        total_taxable += amount
        sst = 0.0
        if doc.agent_result and isinstance(doc.agent_result, dict):
            sst = doc.agent_result.get("amount", {}).get("sst_amount", 0.0)
            if not isinstance(sst, (int, float)) or sst <= 0:
                sst = amount * 0.06
        else:
            sst = amount * 0.06
        if doc.tax_treatment == "output_tax":
            total_sst_output += float(sst)
        else:
            total_sst_input += float(sst)
    return total_taxable, total_sst_output, total_sst_input


def _prepare_sst02_mapping_with_ai(docs: list[Document]) -> tuple[list[dict], float, float]:
    fallback_rows = _build_b1_rows(docs)
    fallback_taxable, fallback_sst, _ = _calculate_totals(docs)
    summaries = [_to_doc_summary(d) for d in docs]
    try:
        ai_map = generate_sst02_field_mapping(summaries)
        rows = ai_map.get("b1_rows") or fallback_rows
        totals = ai_map.get("totals") or {}
        taxable = float(totals.get("item_11c_taxable", fallback_taxable) or fallback_taxable)
        sst = float(totals.get("item_11c_tax", fallback_sst) or fallback_sst)
        return rows, taxable, sst
    except Exception:
        return fallback_rows, fallback_taxable, fallback_sst


def _prepare_sst02_audit_payload(docs: list[Document]) -> dict:
    fallback_rows = _build_sst02_audit_rows(docs)
    fallback_taxable, fallback_sst, _ = _calculate_totals(docs)
    summaries = [_to_doc_summary(d) for d in docs]
    summary_by_id = {s["id"]: s for s in summaries}
    try:
        ai_map = generate_sst02_field_mapping(summaries)
        ai_rows = ai_map.get("b1_rows") or []
        norm_rows = []
        for idx, row in enumerate(ai_rows):
            source_ids = [x for x in (row.get("source_document_ids") or []) if x in summary_by_id]
            source_receipts = [summary_by_id[sid] for sid in source_ids]
            norm_rows.append(
                {
                    "b1_line": idx + 1,
                    "description": row.get("description", "TAXABLE SERVICE"),
                    "service_code": row.get("service_code", "H"),
                    "taxable_value": float(row.get("taxable_value") or 0.0),
                    "source_document_ids": source_ids,
                    "source_receipts": source_receipts,
                    "reasoning": row.get("reasoning", "AI mapping"),
                    "mapping_method": "ai",
                }
            )
        totals = ai_map.get("totals") or {}
        return {
            "rows": norm_rows or fallback_rows,
            "totals": {
                "item_11c_taxable": float(totals.get("item_11c_taxable", fallback_taxable) or fallback_taxable),
                "item_11c_tax": float(totals.get("item_11c_tax", fallback_sst) or fallback_sst),
            },
            "notes": ai_map.get("notes", ""),
            "mapping_method": "ai" if norm_rows else "deterministic-fallback",
        }
    except Exception:
        return {
            "rows": fallback_rows,
            "totals": {
                "item_11c_taxable": fallback_taxable,
                "item_11c_tax": fallback_sst,
            },
            "notes": "AI mapping unavailable; using deterministic fallback.",
            "mapping_method": "deterministic-fallback",
        }


@router.post("/process-text", response_model=ProcessResponse)
def process_text(request: ProcessRequest, db: Session = Depends(get_db)):
    if not request.ocr_text.strip():
        raise HTTPException(400, "OCR text cannot be empty")
    result = process_receipt(request.ocr_text)
    doc = _save_to_db(db, request.ocr_text, result)
    if "error" in result:
        return ProcessResponse(success=False, error=result["error"])
    return ProcessResponse(success=True, data=AgentResult(**result), document_id=doc.id)


@router.post("/upload", response_model=ProcessResponse)
async def upload_document(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No file provided")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    content = await file.read()
    with open(os.path.join(UPLOAD_DIR, file.filename), "wb") as f:
        f.write(content)
    generated_file_url = f"http://localhost:8000/static/uploads/{file.filename}"
    try:
        text = perform_ocr(content, file.filename)
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except RuntimeError as re:
        raise HTTPException(500, str(re))
    if not text.strip():
        raise HTTPException(400, "Unable to extract text from file. Please retake the photo.")

    result = process_receipt(text)
    current_user = _get_current_user(authorization, db)
    doc = _save_to_db(
        db,
        text,
        result,
        filename=file.filename,
        file_url=generated_file_url,
        client_id=current_user.id if current_user else None,
        client_email=current_user.email if current_user else None,
        company_name=current_user.company_name if current_user else None,
    )
    if "error" in result:
        return ProcessResponse(success=False, error=result["error"])
    _invalidate_batch_cache()
    return ProcessResponse(success=True, data=AgentResult(**result), document_id=doc.id)


@router.get("")
def list_documents(
    status: str = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    query = db.query(Document).order_by(Document.created_at.desc())
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    if status:
        query = query.filter(Document.status == status)
    docs = query.limit(100).all()
    return {"count": len(docs), "documents": [_doc_to_dict(d, db) for d in docs]}


@router.get("/clients")
def list_clients_with_documents(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    current_user = _get_current_user(authorization, db)
    
    if current_user and current_user.role == "accountant":
        registered_clients = db.query(User).filter(
            User.role == "client",
            User.bound_accountant_id == current_user.id
        ).all()
        client_ids = [c.id for c in registered_clients]
        docs = db.query(Document).filter(Document.client_id.in_(client_ids)).all() if client_ids else []
    else:
        docs = db.query(Document).filter(Document.client_id != None).all()
        registered_clients = db.query(User).filter(User.role == "client").all()

    clients: dict = {}
    for doc in docs:
        cid = doc.client_id
        if cid not in clients:
            clients[cid] = {
                "client_id": cid,
                "client_email": doc.client_email,
                "company_name": doc.company_name or doc.client_email,
                "pending_count": 0,
                "total_count": 0,
            }
        clients[cid]["total_count"] += 1
        if doc.status in ("processed", "pending_review"):
            clients[cid]["pending_count"] += 1

    for u in registered_clients:
        if u.id not in clients:
            clients[u.id] = {
                "client_id": u.id,
                "client_email": u.email,
                "company_name": u.company_name or u.email,
                "pending_count": 0,
                "total_count": 0,
            }
    return {"clients": list(clients.values())}


@router.get("/tax-advice")
def get_tax_advice(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    current_user = _get_current_user(authorization, db)
    query = db.query(Document).filter(Document.status.in_(["processed", "approved", "signed"]))
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    docs = query.limit(100).all()
    if not docs:
        return {
            "advice": [],
            "summary": "Upload receipts first to receive personalized tax planning suggestions.",
            "disclaimer": "AI-generated guidance for reference only. Consult a qualified tax professional.",
        }

    total_input = sum(d.total_amount or 0 for d in docs if d.tax_treatment and "input_tax" in d.tax_treatment)
    total_output = sum(d.total_amount or 0 for d in docs if d.tax_treatment == "output_tax")
    unclear = sum(1 for d in docs if d.tax_treatment == "unclear")
    risks = sum(1 for d in docs if (d.risk_count or 0) > 0)
    summary_payload = {
        "documents": len(docs),
        "total_input": total_input,
        "total_output": total_output,
        "unclear_count": unclear,
        "risk_count": risks,
    }

    tips = [
        {
            "type": "net_payable",
            "title": "Net SST Snapshot",
            "detail": f"Estimated output-tax base is RM {total_output:,.2f}; prioritize validating output-tax receipts first.",
            "priority": "high",
        },
        {
            "type": "input_quality",
            "title": "Input Receipt Hygiene",
            "detail": f"{unclear} unclear receipt(s) and {risks} risk-flagged item(s) detected; clear these before filing.",
            "priority": "medium" if (unclear + risks) > 0 else "low",
        },
        {
            "type": "deadline",
            "title": "Action This Week",
            "detail": "Finalize accountant review, regenerate signed SST-02, and submit via MySST before due date.",
            "priority": "high",
        },
    ]

    # Optional short AI refinement, but keep concise fallback style.
    try:
        ai_line = generate_personalized_email(summary_payload, 4).split("\n")[0][:220]
        tips[0]["detail"] = ai_line
    except Exception:
        pass

    return {
        "advice": tips,
        "summary": f"Based on {len(docs)} documents: RM {total_input:,.2f} input, RM {total_output:,.2f} output.",
        "disclaimer": "AI-generated guidance for reference only. Consult a qualified tax professional.",
        "generated_at": str(datetime.utcnow()),
    }


@router.post("/submit-period")
def submit_period(
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    year = int(request.get("year", 2026))
    month = int(request.get("month", 4))
    target_months = [3, 4] if month == 4 else [month]
    current_user = _get_current_user(authorization, db)
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status == "processed",
    )
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    docs = query.all()
    ai_approved_count = 0
    for doc in docs:
        confidence = doc.confidence or 0
        if confidence >= 0.90:
            doc.status = "approved"
            doc.reviewed_by = "TaxMate AI"
            doc.review_action = "ai_approved"
            doc.reviewed_at = datetime.now()
            ai_approved_count += 1
        else:
            doc.status = "pending_review"
    db.commit()
    msg = f"{len(docs)} document(s) submitted for review."
    if ai_approved_count > 0:
        msg = f"{ai_approved_count} auto-approved (AI confidence ≥ 90%), {len(docs) - ai_approved_count} pending accountant review."
    return {"submitted": len(docs), "ai_approved": ai_approved_count, "message": msg}


@router.get("/export-sst02")
async def export_official_sst02(
    year: int = 2026,
    month: int = 4,
    is_draft: bool = True,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    target_months = [3, 4] if month == 4 else [month]
    start_m = min(target_months)
    end_m = max(target_months)
    current_user = _get_current_user(authorization, db)
    requested_client_id = current_user.id if current_user and current_user.role == "client" else None

    if not is_draft:
        signed_query = db.query(Document).filter(
            extract("year", Document.created_at) == year,
            extract("month", Document.created_at).in_(target_months),
            Document.status == "signed",
            Document.signature_path != None,
        )
        if requested_client_id:
            signed_query = signed_query.filter(Document.client_id == requested_client_id)
        signed_docs = signed_query.order_by(Document.signed_at.desc()).all()
        if not signed_docs:
            raise HTTPException(404, "No signed SST-02 found. Please have your accountant review and sign first.")
        signed_path = signed_docs[0].signature_path
        if not signed_path or not os.path.exists(signed_path):
            raise HTTPException(404, "Signed SST-02 file missing on server. Please re-sign.")
        return FileResponse(
            signed_path,
            media_type="application/pdf",
            filename=f"SST-02_{year}_M{start_m:02d}M{end_m:02d}_OFFICIAL_SIGNED.pdf",
        )

    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status.in_(["processed", "pending_review", "approved", "signed"]),
    )
    if requested_client_id:
        query = query.filter(Document.client_id == requested_client_id)
    docs = query.all()
    if not docs:
        raise HTTPException(400, f"No processed documents found for {year} period {start_m:02d}-{end_m:02d}.")

    b1_rows = _build_b1_rows(docs)
    total_taxable, total_sst_output, total_sst_input = _calculate_totals(docs)
    period_end_day = calendar.monthrange(year, end_m)[1]
    company_name = (current_user.company_name.upper() if current_user and current_user.company_name else "TAX MATE SDN BHD")
    sst_no = (current_user.tin_number if current_user and current_user.tin_number else "W10-2604-32000123")
    declarant_name = ((current_user.company_name or current_user.email.split("@")[0]).upper() if current_user else "BUSINESS OWNER")
    phone = (current_user.phone_number if current_user and current_user.phone_number else "012-3456789")

    pdf_data = {
        "year": year,
        "month": end_m,
        "sst_no": sst_no,
        "company_name": company_name,
        "period_start": f"01/{start_m:02d}/{year}",
        "period_end": f"{period_end_day:02d}/{end_m:02d}/{year}",
        "taxable_amount_6pct": total_taxable,
        "sst_amount": total_sst_output,
        "input_tax_deduction": total_sst_input,
        "declarant_name": declarant_name,
        "declarant_ic": "000000-00-0000",
        "declarant_position": "DIRECTOR",
        "phone": phone,
        "b1_rows": b1_rows,
    }

    try:
        text_filled = generate_sst02_pdf(pdf_data, is_draft=True)
        draft_path = text_filled.replace(".pdf", "_draft.pdf")
        signature_pic = os.path.join(os.path.dirname(text_filled), "..", "templates", "test_sign.png")
        apply_signature_to_pdf(text_filled, signature_pic, draft_path, is_draft=True)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {str(e)}")

    return FileResponse(
        draft_path,
        media_type="application/pdf",
        filename=f"SST-02_{year}_M{start_m:02d}M{end_m:02d}_DRAFT.pdf",
    )


@router.post("/sign-sst02")
async def sign_sst02(
    background_tasks: BackgroundTasks,
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    signature_b64 = request.get("signature_data", "")
    year = int(request.get("year", 2026))
    month = int(request.get("month", 4))
    client_id = request.get("client_id")
    current_user = _get_current_user(authorization, db)

    if signature_b64.startswith("data:image"):
        signature_b64 = signature_b64.split(",", 1)[1]
    sig_bytes = base64.b64decode(signature_b64)
    sig_temp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    sig_temp.write(sig_bytes)
    sig_temp.close()

    target_months = [3, 4] if month == 4 else [month]
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status == "approved",
    )
    if client_id:
        query = query.filter(Document.client_id == client_id)
    docs = query.all()
    if not docs:
        raise HTTPException(400, "No approved documents found for this period.")

    b1_rows = _build_b1_rows(docs)
    total_taxable, total_sst_output, total_sst_input = _calculate_totals(docs)
    period_end_day = calendar.monthrange(year, max(target_months))[1]
    signer_name = (current_user.name or current_user.email) if current_user else "Accountant"
    client_user = db.query(User).filter(User.id == client_id).first() if client_id else None
    company_name = ((client_user.company_name or "TAX MATE SDN BHD").upper() if client_user else "TAX MATE SDN BHD")
    sst_no = (client_user.tin_number if client_user and client_user.tin_number else "W10-2604-32000123")
    client_phone = (client_user.phone_number if client_user and client_user.phone_number else "012-3456789")

    pdf_data = {
        "year": year,
        "month": max(target_months),
        "sst_no": sst_no,
        "company_name": company_name,
        "period_start": f"01/{min(target_months):02d}/{year}",
        "period_end": f"{period_end_day:02d}/{max(target_months):02d}/{year}",
        "taxable_amount_6pct": total_taxable,
        "sst_amount": total_sst_output,
        "input_tax_deduction": total_sst_input,
        "declarant_name": signer_name.upper(),
        "declarant_ic": current_user.ic_number if current_user and current_user.ic_number else "000000-00-0000",
        "declarant_position": "ACCOUNTANT",
        "phone": client_phone,
        "b1_rows": b1_rows,
    }
    try:
        text_filled = generate_sst02_pdf(pdf_data, is_draft=False)
        suffix = f"_{client_id}" if client_id else ""
        final_path = text_filled.replace(".pdf", f"{suffix}_accountant_signed.pdf")
        apply_signature_to_pdf(text_filled, sig_temp.name, final_path, is_draft=False)
        os.unlink(sig_temp.name)
    except Exception as e:
        os.unlink(sig_temp.name)
        raise HTTPException(500, f"PDF signing error: {str(e)}")

    signed_at = datetime.utcnow()
    for doc in docs:
        doc.status = "signed"
        doc.review_action = "signed"
        doc.reviewed_by = current_user.id if current_user else "accountant_demo"
        doc.signed_by = signer_name
        doc.signed_at = signed_at
        doc.signature_path = final_path
    db.commit()

    client_email = (client_user.email if client_user else None) or (docs[0].client_email if docs and docs[0].client_email else None)
    email_body = None
    try:
        batch = analyze_monthly_batch([_to_doc_summary(d) for d in docs])
        email_body = generate_personalized_email(
            {
                "net_payable": total_sst,
                "total_documents": len(docs),
                "compliance_issues": batch.get("compliance_issues", []) if isinstance(batch, dict) else [],
                "summary": batch.get("summary", "") if isinstance(batch, dict) else "",
            },
            max(target_months),
        )
    except Exception:
        email_body = None
    if client_email:
        background_tasks.add_task(send_approved_report_email, client_email, final_path, max(target_months), email_body)

    with open(final_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode()
    return {
        "success": True,
        "message": "SST-02 signed and emailed to client.",
        "pdf_base64": pdf_b64,
        "client_email": client_email,
        "signed_by": signer_name,
    }


@router.get("/batch-analysis")
def get_batch_analysis(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    current_user = _get_current_user(authorization, db)
    cache_key = f"batch_{current_user.id}" if current_user else "batch_all"

    # Return cached result if fresh
    if cache_key in _batch_cache:
        cached_ts, cached_result = _batch_cache[cache_key]
        if time.time() - cached_ts < _BATCH_CACHE_TTL:
            return cached_result

    query = db.query(Document).filter(Document.status.in_(["processed", "pending_review", "approved", "signed"]))
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    docs = query.all()
    if not docs:
        result = {
            "batch_health": "needs_review",
            "total_documents": 0,
            "total_input_tax_claimable": 0,
            "total_input_tax_not_claimable": 0,
            "total_output_tax": 0,
            "net_payable": 0,
            "duplicate_warnings": [],
            "anomalies": [],
            "tax_tips": [],
            "compliance_issues": [],
            "filing_readiness": {"ready_count": 0, "needs_review_count": 0, "blocked_count": 0, "recommendation": "Upload receipts first."},
            "summary": "No documents available for analysis yet.",
        }
        _batch_cache[cache_key] = (time.time(), result)
        return result
    result = analyze_monthly_batch(
        [
            {
                "supplier_name": d.supplier_name,
                "total_amount": d.total_amount,
                "tax_treatment": d.tax_treatment,
                "risk_count": d.risk_count,
                "agent_result": d.agent_result or {},
            }
            for d in docs
        ]
    )
    _batch_cache[cache_key] = (time.time(), result)
    return result


@router.get("/review-brief")
def get_review_brief(
    year: int = 2026,
    month: int = 4,
    client_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    target_months = [3, 4] if month == 4 else [month]
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status.in_(["processed", "pending_review", "approved", "signed"]),
    )
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    elif client_id:
        query = query.filter(Document.client_id == client_id)
    docs = query.order_by(Document.created_at.desc()).all()
    if not docs:
        return {"brief": "No documents yet for this period.", "count": 0}
    try:
        brief = generate_review_brief([_to_doc_summary(d) for d in docs])
    except Exception:
        high_risk = sum(1 for d in docs if (d.risk_count or 0) > 0)
        brief = (
            f"Loaded {len(docs)} document(s). "
            f"High-risk count: {high_risk}. "
            "Please review high-risk documents, verify tax treatment, then sign SST-02."
        )
    return {"brief": brief, "count": len(docs)}


@router.post("/chat")
def chat_with_agent(
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    question = (request.get("question") or "").strip()
    if not question:
        raise HTTPException(400, "Question is required.")
    year = int(request.get("year", 2026))
    month = int(request.get("month", 4))
    client_id = request.get("client_id")
    target_months = [3, 4] if month == 4 else [month]
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status.in_(["processed", "pending_review", "approved", "signed"]),
    )
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    elif client_id:
        query = query.filter(Document.client_id == client_id)
    docs = query.order_by(Document.created_at.desc()).limit(200).all()
    try:
        answer = answer_accountant_question(question, [_to_doc_summary(d) for d in docs])
    except Exception:
        answer = "AI service is temporarily unavailable. Please retry in a few seconds."
    return {"answer": answer, "context_count": len(docs)}


@router.get("/sst02-audit")
def get_sst02_audit(
    year: int = 2026,
    month: int = 4,
    client_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    target_months = [3, 4] if month == 4 else [month]
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status.in_(["processed", "pending_review", "approved", "signed"]),
    )
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    elif client_id:
        query = query.filter(Document.client_id == client_id)

    docs = query.order_by(Document.created_at.desc()).all()
    payload = _prepare_sst02_audit_payload(docs)
    payload.update(
        {
            "year": year,
            "month": month,
            "document_count": len(docs),
        }
    )
    return payload


@router.get("/{doc_id}")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_url": getattr(doc, "file_url", None),
        "ocr_text": doc.ocr_text,
        "agent_result": doc.agent_result,
        "status": doc.status,
        "client_id": doc.client_id,
        "client_email": doc.client_email,
        "company_name": doc.company_name,
        "reviewed_by": _resolve_reviewer_name(doc.reviewed_by, db),
        "review_action": doc.review_action,
        "signed_by": doc.signed_by,
        "signed_at": str(doc.signed_at) if doc.signed_at else None,
        "created_at": str(doc.created_at),
    }


@router.post("/{doc_id}/approve")
def approve_document(
    doc_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    current_user = _get_current_user(authorization, db)
    doc.status = "approved"
    doc.review_action = "approved"
    doc.reviewed_by = current_user.id if current_user else "accountant_demo"
    db.commit()
    return {"message": "Document approved", "id": doc_id}


@router.post("/{doc_id}/reject")
def reject_document(
    doc_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    current_user = _get_current_user(authorization, db)
    doc.status = "rejected"
    doc.review_action = "rejected"
    doc.reviewed_by = current_user.id if current_user else "accountant_demo"
    db.commit()
    return {"message": "Document rejected", "id": doc_id}


@router.put("/{doc_id}/review")
def review_and_update_document(
    doc_id: str,
    request: DocumentReviewRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.tax_treatment = request.tax_treatment
    doc.total_amount = request.total_amount
    if request.supplier_name:
        doc.supplier_name = request.supplier_name
    if doc.agent_result:
        updated = doc.agent_result.copy()
        updated["tax_treatment"] = request.tax_treatment
        updated.setdefault("amount", {})
        updated["amount"]["total"] = request.total_amount
        if request.supplier_name:
            updated.setdefault("supplier", {})
            updated["supplier"]["name"] = request.supplier_name
        updated["confidence"] = 1.0
        updated["risk_flags"] = []
        doc.agent_result = updated
    current_user = _get_current_user(authorization, db)
    if request.action == "approve":
        doc.status = "approved"
        doc.review_action = "approved"
        doc.reviewed_by = current_user.id if current_user else "accountant_demo"
    else:
        doc.status = "pending_review"
    db.commit()
    return {"message": "Document updated successfully", "id": doc_id, "new_status": doc.status}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(404, "Document not found")
    try:
        db.delete(db_doc)
        db.commit()
        return {"status": "success", "message": f"Document {doc_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database error: {str(e)}")


# ── Workflow Orchestrator ──────────────────────────────────────────────────────

@router.post("/workflow/next-step")
def get_next_workflow_step(
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Ask the AI Orchestrator: what should happen next?
    The orchestrator checks workflow state and decides the next action.
    """
    intent = request.get("intent", "continue")
    current_user = _get_current_user(authorization, db)

    query = db.query(Document).order_by(Document.created_at.desc())
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)
    elif current_user and current_user.role == "accountant":
        client_ids = [c.id for c in db.query(User).filter(
            User.role == "client", User.bound_accountant_id == current_user.id
        ).all()]
        if client_ids:
            query = query.filter(Document.client_id.in_(client_ids))

    docs = query.limit(200).all()

    workflow_state = {
        "documents": [{
            "id": d.id,
            "supplier_name": d.supplier_name,
            "total_amount": d.total_amount,
            "tax_treatment": d.tax_treatment,
            "risk_count": d.risk_count,
            "confidence": d.confidence,
            "status": d.status,
            "review_action": d.review_action,
            "agent_result": d.agent_result or {},
        } for d in docs]
    }

    try:
        result = run_orchestrator(workflow_state, intent)
    except Exception as e:
        result = {
            "recommendation": f"AI Orchestrator is temporarily unavailable. You can still proceed with manual review across {len(docs)} document(s).",
            "thinking_steps": [{"step": 1, "type": "error", "action": str(e)}],
            "actions_taken": [],
        }

    return result

"""
Document processing API routes - v0.3 with auth, signing, and tax advice
"""
import base64
import io
import os
import tempfile
import calendar
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import extract
from sqlalchemy.orm import Session

from ..agents.tax_agent import analyze_monthly_batch, process_receipt
from ..models.database import get_db
from ..models.document import Document
from ..models.user import User
from ..schemas.document import AgentResult, DocumentReviewRequest, ProcessRequest, ProcessResponse
from ..services.auth_service import decode_access_token
from ..services.email_service import send_approved_report_email
from ..services.ocr_service import perform_ocr
from ..services.sst02_filler import apply_signature_to_pdf, generate_sst02_pdf

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "app/static/uploads"


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _get_current_user(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        return None
    return db.query(User).filter(User.id == payload["sub"]).first()


# ── DB helpers ────────────────────────────────────────────────────────────────

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


def _doc_to_dict(doc: Document) -> dict:
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
        "reviewed_by": doc.reviewed_by,
        "review_action": doc.review_action,
        "signed_by": doc.signed_by,
        "signed_at": str(doc.signed_at) if doc.signed_at else None,
        "created_at": str(doc.created_at),
        "updated_at": str(doc.updated_at),
        "agent_result": doc.agent_result,
    }


def _calculate_totals(docs: list[Document]) -> tuple[float, float]:
    """Keep SST totals consistent across draft and signed exports."""
    total_taxable = 0.0
    total_sst = 0.0
    for doc in docs:
        amount = float(doc.total_amount or 0.0)
        # Only output-tax transactions should contribute to payable SST.
        if doc.tax_treatment == "output_tax":
            total_taxable += amount
            if doc.agent_result and isinstance(doc.agent_result, dict):
                sst = doc.agent_result.get("amount", {}).get("sst_amount")
                if isinstance(sst, (int, float)) and sst > 0:
                    total_sst += float(sst)
                    continue
            total_sst += amount * 0.06
    return total_taxable, total_sst


def _build_b1_rows(docs: list[Document]) -> list[dict]:
    """
    Map each receipt to one SST-02 B1 row (service context).
    """
    rows: list[dict] = []
    for doc in docs:
        # For SST-02 service section, keep output-tax receipts as taxable lines.
        if doc.tax_treatment != "output_tax":
            continue

        agent_amount = (doc.agent_result or {}).get("amount", {}) if isinstance(doc.agent_result, dict) else {}
        subtotal = agent_amount.get("subtotal")
        sst_amount = agent_amount.get("sst_amount")
        total = doc.total_amount or agent_amount.get("total") or 0.0

        taxable_value = None
        if isinstance(subtotal, (int, float)) and subtotal > 0:
            taxable_value = float(subtotal)
        elif isinstance(total, (int, float)) and isinstance(sst_amount, (int, float)) and total > sst_amount:
            taxable_value = float(total - sst_amount)
        elif isinstance(total, (int, float)):
            taxable_value = float(total)

        if taxable_value is None:
            continue

        supplier = (doc.supplier_name or "UNSPECIFIED SUPPLIER").strip().upper()
        rows.append(
            {
                "description": supplier,
                # Group H services code family marker in this demo template.
                "service_code": "H",
                "taxable_value": round(max(0.0, taxable_value), 2),
            }
        )

    return rows


# ── Routes ────────────────────────────────────────────────────────────────────

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

    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    content = await file.read()

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
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

    # Attach client identity if authenticated
    current_user = _get_current_user(authorization, db)
    client_id = current_user.id if current_user else None
    client_email = current_user.email if current_user else None
    company_name = current_user.company_name if current_user else None

    doc = _save_to_db(
        db, text, result,
        filename=file.filename,
        file_url=generated_file_url,
        client_id=client_id,
        client_email=client_email,
        company_name=company_name,
    )

    if "error" in result:
        return ProcessResponse(success=False, error=result["error"])

    return ProcessResponse(success=True, data=AgentResult(**result), document_id=doc.id)


@router.get("")
def list_documents(
    status: str = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    query = db.query(Document).order_by(Document.created_at.desc())

    # If authenticated client, show only their documents
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)

    if status:
        query = query.filter(Document.status == status)

    docs = query.limit(100).all()
    return {"count": len(docs), "documents": [_doc_to_dict(d) for d in docs]}


@router.get("/clients")
def list_clients_with_documents(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Return unique clients that have uploaded documents (for accountant dashboard)."""
    current_user = _get_current_user(authorization, db)
    if not current_user or current_user.role != "accountant":
        # Fall back to returning all distinct client names from documents
        pass

    docs = db.query(Document).filter(Document.client_id != None).all()
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

    # Also include User records for clients who registered but haven't uploaded yet
    registered_clients = db.query(User).filter(User.role == "client").all()
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
    """AI-generated tax planning tips based on uploaded documents."""
    current_user = _get_current_user(authorization, db)
    query = db.query(Document).filter(Document.status.in_(["processed", "approved"]))
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)

    docs = query.limit(50).all()

    if not docs:
        return {
            "advice": [],
            "summary": "Upload receipts first to receive personalised tax planning suggestions.",
            "disclaimer": _disclaimer(),
        }

    total_input = sum(d.total_amount or 0 for d in docs if d.tax_treatment == "input_tax_claimable")
    total_output = sum(d.total_amount or 0 for d in docs if d.tax_treatment == "output_tax")
    unclear_count = sum(1 for d in docs if d.tax_treatment == "unclear")
    high_risk_count = sum(1 for d in docs if (d.risk_count or 0) > 0)
    personal_count = sum(1 for d in docs if d.tax_treatment == "personal_expense")

    advice = []

    if total_input > 0:
        advice.append({
            "type": "savings",
            "title": "Claimable Input Tax Detected",
            "detail": (
                f"You have RM {total_input:,.2f} in claimable input tax across your uploaded receipts. "
                "Ensure all supplier SST registration numbers are valid to maximise your offset against output tax."
            ),
            "priority": "high",
        })

    if total_output > 0:
        net = total_output - total_input
        if net > 0:
            advice.append({
                "type": "info",
                "title": f"Estimated Net SST Payable: RM {net:,.2f}",
                "detail": (
                    "Your output tax exceeds your claimable input tax for this period. "
                    "Review all input receipts to ensure none have been missed."
                ),
                "priority": "medium",
            })

    if unclear_count > 0:
        advice.append({
            "type": "action",
            "title": f"{unclear_count} Receipt(s) Need Clarification",
            "detail": (
                "Some documents could not be classified automatically. "
                "Review them in your Documents page and ask your accountant for guidance — "
                "reclassifying them could reduce your SST liability."
            ),
            "priority": "medium",
        })

    if high_risk_count > 0:
        advice.append({
            "type": "warning",
            "title": f"Compliance Flags on {high_risk_count} Receipt(s)",
            "detail": (
                "Risk flags such as missing SST numbers, incorrect rates, or calculation mismatches were detected. "
                "Address these before filing to avoid JKDM penalties."
            ),
            "priority": "high",
        })

    if personal_count > 0:
        advice.append({
            "type": "info",
            "title": "Personal Expenses Detected",
            "detail": (
                f"{personal_count} receipt(s) were identified as personal expenses — these are not deductible for SST purposes. "
                "Keep personal and business expenses clearly separated."
            ),
            "priority": "low",
        })

    advice.append({
        "type": "general",
        "title": "E-Invoice Compliance Reminder",
        "detail": (
            "From January 2026, businesses with annual revenue between RM 1M and RM 5M must comply with LHDNM e-invoice requirements. "
            "Ensure your suppliers are issuing valid e-invoices to maintain input tax claimability."
        ),
        "priority": "medium",
    })

    advice.append({
        "type": "general",
        "title": "SST-02 Filing Deadline",
        "detail": (
            "The SST-02 for the Mar–Apr 2026 period is due by 31 May 2026. "
            "Upload all outstanding receipts and have your accountant review them before the deadline to avoid late filing penalties (RM 1,000–RM 400,000)."
        ),
        "priority": "high",
    })

    return {
        "advice": advice,
        "summary": f"Based on {len(docs)} documents: RM {total_input:,.2f} input tax claimable, RM {total_output:,.2f} output tax.",
        "disclaimer": _disclaimer(),
        "generated_at": str(datetime.utcnow()),
    }


def _disclaimer() -> str:
    return (
        "⚠️ IMPORTANT DISCLAIMER: The above suggestions are generated by AI based on your uploaded receipts "
        "and are provided for reference purposes only. They do not constitute professional tax, legal, or financial advice. "
        "Tax laws and SST regulations may change. For all tax-related decisions, always consult a qualified Malaysian tax professional "
        "or your assigned accountant. TaxMate accepts no liability for decisions made based solely on these AI-generated suggestions."
    )


@router.post("/submit-period")
def submit_period(
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Client submits all docs for a period to accountant review (processed → pending_review)."""
    year = int(request.get("year", 2026))
    month = int(request.get("month", 4))
    target_months = [3, 4] if month == 4 else [month]

    current_user = _get_current_user(authorization, db)

    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status == "processed",
    )
    if current_user:
        query = query.filter(Document.client_id == current_user.id)

    docs = query.all()
    for doc in docs:
        doc.status = "pending_review"
    db.commit()
    return {"submitted": len(docs), "message": f"{len(docs)} document(s) submitted for review."}


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

    requested_client_id = None
    if current_user and current_user.role == "client":
        requested_client_id = current_user.id

    # For signed download: return this client's latest signed file for the period
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
            raise HTTPException(
                status_code=404,
                detail="No signed SST-02 found. Please have your accountant review and sign the documents first.",
            )

        pattern = signed_docs[0].signature_path
        if not pattern or not os.path.exists(pattern):
            raise HTTPException(
                status_code=404,
                detail="Signed SST-02 file is missing on server. Please re-sign and try again.",
            )
        display_name = f"SST-02_{year}_M{start_m:02d}M{end_m:02d}_OFFICIAL_SIGNED.pdf"
        return FileResponse(pattern, media_type="application/pdf", filename=display_name)

    # Draft: query all client documents for this period (any non-error status)
    query = db.query(Document).filter(
        extract("year", Document.created_at) == year,
        extract("month", Document.created_at).in_(target_months),
        Document.status.in_(["processed", "pending_review", "approved", "signed"]),
    )
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)

    docs = query.all()
    if not docs:
        raise HTTPException(
            status_code=400,
            detail=f"No processed documents found for {year} period {start_m:02d}-{end_m:02d}. Please upload receipts first.",
        )

    total_taxable, total_sst = _calculate_totals(docs)
    b1_rows = _build_b1_rows(docs)
    period_end_day = calendar.monthrange(year, end_m)[1]

    company_name = "TAX MATE SDN BHD"
    sst_no = "W10-2604-32000123"
    declarant_name = "BUSINESS OWNER"
    declarant_ic = "000000-00-0000"
    phone = "012-3456789"

    if current_user and current_user.role == "client":
        if current_user.company_name:
            company_name = current_user.company_name.upper()
        if current_user.tin_number:
            sst_no = current_user.tin_number
        declarant_name = (current_user.company_name or current_user.email.split("@")[0]).upper()
        if current_user.phone_number:
            phone = current_user.phone_number

    pdf_data = {
        "year": year,
        "month": end_m,
        "sst_no": sst_no,
        "company_name": company_name,
        "period_start": f"01/{start_m:02d}/{year}",
        "period_end": f"{period_end_day:02d}/{end_m:02d}/{year}",
        "taxable_amount_6pct": total_taxable,
        "sst_amount": total_sst,
        "declarant_name": declarant_name,
        "declarant_ic": declarant_ic,
        "declarant_position": "DIRECTOR",
        "phone": phone,
    }

    try:
        text_filled_pdf_path = generate_sst02_pdf(pdf_data)
        final_pdf_path = text_filled_pdf_path.replace(".pdf", "_draft.pdf")
        signature_pic = os.path.join(
            os.path.dirname(text_filled_pdf_path), "..", "templates", "test_sign.png"
        )
        apply_signature_to_pdf(
            text_filled_pdf_path,
            signature_pic,
            final_pdf_path,
            is_draft=True,
            b1_rows=b1_rows,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    display_name = f"SST-02_{year}_M{start_m:02d}M{end_m:02d}_DRAFT.pdf"
    return FileResponse(final_pdf_path, media_type="application/pdf", filename=display_name)


@router.post("/{doc_id}/sign")
async def sign_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    # Body via JSON
    signature_data: dict = None,
):
    """
    Accountant signs: receives base64 PNG signature, applies to draft PDF,
    updates document status to 'signed', emails the client.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    current_user = _get_current_user(authorization, db)
    signer_name = current_user.name or current_user.email if current_user else "accountant"

    doc.status = "signed"
    doc.signed_by = signer_name
    doc.signed_at = datetime.utcnow()
    doc.review_action = "signed"
    if current_user:
        doc.reviewed_by = current_user.id
    db.commit()

    return {
        "message": "Document signed successfully",
        "id": doc_id,
        "signed_by": signer_name,
        "signed_at": str(doc.signed_at),
    }


@router.post("/sign-sst02")
async def sign_sst02(
    background_tasks: BackgroundTasks,
    request: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Accountant submits signature for final SST-02 PDF.
    Accepts: { signature_data: base64_png, year: int, month: int, client_id: str }
    Returns: signed PDF as base64 + sends email to client.
    """
    signature_b64 = request.get("signature_data", "")
    year = int(request.get("year", 2026))
    month = int(request.get("month", 4))
    client_id = request.get("client_id")

    current_user = _get_current_user(authorization, db)

    # Save signature image to temp file
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

    total_taxable, total_sst = _calculate_totals(docs)
    b1_rows = _build_b1_rows(docs)
    period_end_day = calendar.monthrange(year, max(target_months))[1]

    # Build company info
    company_name = "TAX MATE SDN BHD"
    sst_no = "W10-2604-32000123"
    if client_id:
        client_user = db.query(User).filter(User.id == client_id).first()
        if client_user:
            company_name = (client_user.company_name or company_name).upper()
            sst_no = client_user.tin_number or sst_no

    signer_name = (current_user.name or current_user.email) if current_user else "Accountant"

    client_phone = "012-3456789"
    if client_id:
        client_user_for_phone = db.query(User).filter(User.id == client_id).first()
        if client_user_for_phone and client_user_for_phone.phone_number:
            client_phone = client_user_for_phone.phone_number

    pdf_data = {
        "year": year,
        "month": max(target_months),
        "sst_no": sst_no,
        "company_name": company_name,
        "period_start": f"01/{min(target_months):02d}/{year}",
        "period_end": f"{period_end_day:02d}/{max(target_months):02d}/{year}",
        "taxable_amount_6pct": total_taxable,
        "sst_amount": total_sst,
        "declarant_name": signer_name.upper(),
        "declarant_ic": current_user.ic_number if current_user and current_user.ic_number else "000000-00-0000",
        "declarant_position": "ACCOUNTANT",
        "phone": client_phone,
    }

    try:
        text_filled = generate_sst02_pdf(pdf_data)
        client_suffix = f"_{client_id}" if client_id else ""
        final_path = text_filled.replace(".pdf", f"{client_suffix}_accountant_signed.pdf")
        apply_signature_to_pdf(
            text_filled,
            sig_temp.name,
            final_path,
            is_draft=False,
            b1_rows=b1_rows,
        )
        os.unlink(sig_temp.name)
    except Exception as e:
        os.unlink(sig_temp.name)
        raise HTTPException(500, f"PDF signing error: {str(e)}")

    signer_id = current_user.id if current_user else "accountant_demo"
    signed_at = datetime.utcnow()
    for doc in docs:
        doc.status = "signed"
        doc.review_action = "signed"
        doc.reviewed_by = signer_id
        doc.signed_by = signer_name
        doc.signed_at = signed_at
        doc.signature_path = final_path
    db.commit()

    # Email client
    client_email = None
    if client_id:
        client_user = db.query(User).filter(User.id == client_id).first()
        if client_user:
            client_email = client_user.email
    if not client_email and docs and docs[0].client_email:
        client_email = docs[0].client_email
    if client_email:
        background_tasks.add_task(
            send_approved_report_email, client_email, final_path, max(target_months)
        )

    # Return signed PDF as base64 for preview
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
    query = db.query(Document).filter(Document.status.in_(["processed", "pending_review", "approved", "signed"]))
    current_user = _get_current_user(authorization, db)
    if current_user and current_user.role == "client":
        query = query.filter(Document.client_id == current_user.id)

    docs = query.all()
    if not docs:
        return {
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
            "filing_readiness": {
                "ready_count": 0,
                "needs_review_count": 0,
                "blocked_count": 0,
                "recommendation": "Upload and process receipts to generate batch analysis.",
            },
            "summary": "No documents available for analysis yet.",
        }

    doc_dicts = [
        {
            "supplier_name": d.supplier_name,
            "total_amount": d.total_amount,
            "tax_treatment": d.tax_treatment,
            "risk_count": d.risk_count,
            "agent_result": d.agent_result or {},
        }
        for d in docs
    ]
    return analyze_monthly_batch(doc_dicts)


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
        "reviewed_by": doc.reviewed_by,
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
        updated_result = doc.agent_result.copy()
        updated_result["tax_treatment"] = request.tax_treatment
        if "amount" not in updated_result:
            updated_result["amount"] = {}
        updated_result["amount"]["total"] = request.total_amount
        if request.supplier_name:
            if "supplier" not in updated_result:
                updated_result["supplier"] = {}
            updated_result["supplier"]["name"] = request.supplier_name
        updated_result["confidence"] = 1.0
        updated_result["risk_flags"] = []
        doc.agent_result = updated_result

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
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        db.delete(db_doc)
        db.commit()
        return {"status": "success", "message": f"Document {doc_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

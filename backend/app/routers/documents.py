"""
Document processing API routes - v0.2 with database storage
"""
import io
import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from ..schemas.document import ProcessRequest, ProcessResponse, AgentResult, DocumentReviewRequest
from ..models.database import get_db
from ..models.document import Document
from ..services.ocr_service import perform_ocr
from fastapi.responses import FileResponse
from sqlalchemy import extract
from ..services.sst02_filler import generate_sst02_pdf, apply_signature_to_pdf
from fastapi import BackgroundTasks 
from ..services.email_service import send_approved_report_email
from ..agents.tax_agent import process_receipt, analyze_monthly_batch

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _save_to_db(db: Session, ocr_text: str, result: dict, filename: str = None) -> Document:
    """Save agent result to database"""
    doc = Document(
        filename=filename,
        ocr_text=ocr_text,
        agent_result=result,
        status="processed" if "error" not in result else "error",
    )

    # 提取关键字段方便查询
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


@router.post("/process-text", response_model=ProcessResponse)
def process_text(request: ProcessRequest, db: Session = Depends(get_db)):
    """Process raw OCR text and save to database."""
    if not request.ocr_text.strip():
        raise HTTPException(400, "OCR text cannot be empty")

    result = process_receipt(request.ocr_text)
    doc = _save_to_db(db, request.ocr_text, result)

    if "error" in result:
        return ProcessResponse(success=False, error=result["error"])

    return ProcessResponse(
        success=True,
        data=AgentResult(**result),
        document_id=doc.id,
    )


@router.post("/upload", response_model=ProcessResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a file, process it, and save to database."""
    if not file.filename:
        raise HTTPException(400, "No file provided")

    content = await file.read()

    # 1. 调用 PaddleOCR 服务提取文本
    try:
        text = perform_ocr(content, file.filename)
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except RuntimeError as re:
        raise HTTPException(500, str(re))

    if not text.strip():
        raise HTTPException(400, "未能从文件中识别出文字，请重新拍照。")

    # 2. 将提取出的文本喂给你现有的 GLM-4.5-Flash Agent
    result = process_receipt(text)
    
    # 3. 落库保存
    doc = _save_to_db(db, text, result, filename=file.filename)

    if "error" in result:
        return ProcessResponse(success=False, error=result["error"])

    return ProcessResponse(
        success=True,
        data=AgentResult(**result),
        document_id=doc.id,
    )


@router.get("")
def list_documents(
    status: str = None,
    db: Session = Depends(get_db),
):
    """Get all documents, optionally filter by status."""
    query = db.query(Document).order_by(Document.created_at.desc())

    if status:
        query = query.filter(Document.status == status)

    docs = query.limit(50).all()

    return {
        "count": len(docs),
        "documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "doc_type": doc.doc_type,
                "supplier_name": doc.supplier_name,
                "total_amount": doc.total_amount,
                "tax_treatment": doc.tax_treatment,
                "confidence": doc.confidence,
                "risk_count": doc.risk_count,
                "status": doc.status,
                "created_at": str(doc.created_at),
            }
            for doc in docs
        ],
    }


@router.get("/export-sst02")
async def export_official_sst02(
    background_tasks: BackgroundTasks, # <-- 1. 注入后台任务对象
    year: int = 2026, 
    month: int = 4, 
    db: Session = Depends(get_db)
):
    """
    拉取当月所有 approved 的收据，计算总额，并生成官方 SST-02 表格并发送邮件。
    """
    # 1. 查数据库逻辑保持不变...
    docs = db.query(Document).filter(
        extract('year', Document.created_at) == year,
        extract('month', Document.created_at) == month,
        Document.status == "approved"
    ).all()

    # 2. 统计金额逻辑保持不变...
    total_taxable_6pct = 0.0
    for doc in docs:
        if doc.tax_treatment in ["output_tax", "input_tax_claimable"]:
            total_taxable_6pct += (doc.total_amount or 0.0)

    # 3. 准备数据字典保持不变...
    pdf_data = {
        "year": year,
        "month": month,
        "sst_no": "W10-2604-32000123",
        "company_name": "TAX MATE SDN BHD", 
        "period_start": f"01/{month:02d}/{year}",
        "period_end": f"30/{month:02d}/{year}",
        "taxable_amount_6pct": total_taxable_6pct,
        "declarant_name": "YAP LI SHAN",
        "declarant_ic": "020101-14-1234",
        "declarant_position": "ACCOUNTANT"
    }

    # 4. 调用 PDF 生成引擎并处理签名
    try:
        # 生成填充好文字的 PDF
        text_filled_pdf_path = generate_sst02_pdf(pdf_data) 
        
        # 定义带签名的输出路径
        final_signed_pdf_path = text_filled_pdf_path.replace(".pdf", "_signed.pdf")
        
        # 获取签名图片路径
        signature_pic = os.path.join(os.path.dirname(text_filled_pdf_path), "..", "templates", "test_sign.png")
        
        # 如果签名图片存在，则盖章
        if os.path.exists(signature_pic):
            apply_signature_to_pdf(text_filled_pdf_path, signature_pic, final_signed_pdf_path)
        else:
            final_signed_pdf_path = text_filled_pdf_path 

        # ==========================================
        # 🚀 2. 核心修改：添加后台发送邮件任务
        # ==========================================
        # 这里你可以设置老板的真实邮箱
        boss_email = "lishan0311@gmail.com" 
        
        # 将发送任务交给后台，这样会计师下载 PDF 时不会因为发邮件而等待
        background_tasks.add_task(
            send_approved_report_email, 
            boss_email, 
            final_signed_pdf_path, 
            month
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF处理或邮件任务启动失败: {str(e)}")

    # 5. 返回文件供浏览器直接下载
    return FileResponse(
        final_signed_pdf_path,
        media_type="application/pdf",
        filename=f"SST-02_{year}_{month:02d}_Signed.pdf"
    )


@router.get("/batch-analysis")
def get_batch_analysis(db: Session = Depends(get_db)):
    """
    L4 Cross-document AI analysis.
    Analyzes ALL monthly receipts together to find:
    - Duplicate invoices
    - Anomalous amounts
    - Tax optimization opportunities
    - Compliance risks
    - SST-02 filing readiness
    """
    docs = db.query(Document).filter(
        Document.status.in_(["processed", "approved"])
    ).all()
 
    if not docs:
        raise HTTPException(400, "No documents to analyze")
 
    doc_dicts = []
    for d in docs:
        doc_dicts.append({
            "supplier_name": d.supplier_name,
            "total_amount": d.total_amount,
            "tax_treatment": d.tax_treatment,
            "risk_count": d.risk_count,
            "agent_result": d.agent_result or {},
        })
 
    analysis = analyze_monthly_batch(doc_dicts)
    return analysis


@router.get("/{doc_id}")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Get a single document with full agent result."""
    doc = db.query(Document).filter(Document.id == doc_id).first()

    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "id": doc.id,
        "filename": doc.filename,
        "ocr_text": doc.ocr_text,
        "agent_result": doc.agent_result,
        "status": doc.status,
        "reviewed_by": doc.reviewed_by,
        "review_action": doc.review_action,
        "created_at": str(doc.created_at),
    }


@router.post("/{doc_id}/approve")
def approve_document(doc_id: str, db: Session = Depends(get_db)):
    """Accountant approves a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.status = "approved"
    doc.review_action = "approved"
    doc.reviewed_by = "accountant_demo"  # 后面接真正的 auth
    db.commit()

    return {"message": "Document approved", "id": doc_id}


@router.post("/{doc_id}/reject")
def reject_document(doc_id: str, db: Session = Depends(get_db)):
    """Accountant rejects a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.status = "rejected"
    doc.review_action = "rejected"
    doc.reviewed_by = "accountant_demo"
    db.commit()

    return {"message": "Document rejected", "id": doc_id}


@router.put("/{doc_id}/review")
def review_and_update_document(
    doc_id: str, 
    request: DocumentReviewRequest, 
    db: Session = Depends(get_db)
):
    """
    会计师在此接口修改 AI 的识别结果，并进行保存或核准。
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    # 1. 更新数据库里的快捷查询字段
    doc.tax_treatment = request.tax_treatment
    doc.total_amount = request.total_amount
    if request.supplier_name:
        doc.supplier_name = request.supplier_name

    # 2. 同步更新存在 JSON 里的原始 Agent 数据 (保持数据一致性)
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
            
        # 既然人工介入了，把置信度拉满，风险清零
        updated_result["confidence"] = 1.0 
        updated_result["risk_flags"] = []
        doc.agent_result = updated_result

    # 3. 处理状态流转
    if request.action == "approve":
        doc.status = "approved"
        doc.review_action = "approved"
        doc.reviewed_by = "accountant_demo"
    else:
        doc.status = "pending_review" # 如果只是暂存

    db.commit()

    return {
        "message": f"Document updated and {request.action}d successfully", 
        "id": doc_id,
        "new_status": doc.status
    }


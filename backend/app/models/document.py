"""
Document & AgentResult database models
"""
from sqlalchemy import Column, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
import uuid
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    filename = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    ocr_text = Column(Text, nullable=False)
    status = Column(String, default="processed")
    # processed / pending_review / approved / rejected / signed

    # Client ownership (linked to User table via email for simplicity)
    client_id = Column(String, nullable=True, index=True)
    client_email = Column(String, nullable=True)        # for email notification
    company_name = Column(String, nullable=True)

    # Agent 输出 (整个 JSON 存一列)
    agent_result = Column(JSON, nullable=True)

    # 从 agent_result 提取的关键字段 (方便查询和排序)
    doc_type = Column(String, nullable=True)
    supplier_name = Column(String, nullable=True)
    total_amount = Column(Float, nullable=True)
    tax_treatment = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    risk_count = Column(Float, default=0)

    # 会计师审核
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_action = Column(String, nullable=True)  # approved / rejected

    # Accountant signature (base64 PNG stored as path after applied to PDF)
    signature_path = Column(String, nullable=True)
    signed_at = Column(DateTime, nullable=True)
    signed_by = Column(String, nullable=True)

    # 时间戳
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
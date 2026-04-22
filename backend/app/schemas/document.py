"""
Pydantic schemas for document processing API
"""
from pydantic import BaseModel
from typing import Optional


class RiskFlag(BaseModel):
    type: str
    severity: str  # low / medium / high
    description: str


class SupplierInfo(BaseModel):
    name: Optional[str] = None
    tin: Optional[str] = None
    sst_number: Optional[str] = None


class AmountInfo(BaseModel):
    subtotal: Optional[float] = None
    sst_amount: Optional[float] = None
    total: Optional[float] = None


class AgentResult(BaseModel):
    doc_type: str
    supplier: SupplierInfo
    date: Optional[str] = None
    amount: AmountInfo
    tax_treatment: str
    confidence: float
    risk_flags: list[RiskFlag] = []
    reasoning: str


class ProcessRequest(BaseModel):
    """Request body for text-based processing"""
    ocr_text: str


class ProcessResponse(BaseModel):
    """Full response wrapper"""
    success: bool
    data: Optional[AgentResult] = None
    error: Optional[str] = None
    document_id: Optional[str] = None

class DocumentReviewRequest(BaseModel):
    """用于会计师修改和审核单据的请求体"""
    tax_treatment: str          # 比如从 "unclear" 改为 "input_tax_claimable"
    total_amount: float         # 修正金额
    supplier_name: Optional[str] = None # 修正供应商名称
    action: str                 # "approve" 或 "save_draft"

class DocumentRead(BaseModel):
    id: str
    filename: Optional[str] = None
    file_url: Optional[str] = None  # <--- 关键：确保这里有 file_url
    ocr_text: str
    status: str
    agent_result: Optional[AgentResult] = None # 引用上面定义好的 AgentResult
    
    # 辅助字段
    supplier_name: Optional[str] = None
    total_amount: Optional[float] = None
    tax_treatment: Optional[str] = None
    confidence: Optional[float] = None
    reviewed_by: Optional[str] = None
    
    class Config:
        from_attributes = True
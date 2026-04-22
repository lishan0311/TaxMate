export interface RiskFlag {
  severity: 'high' | 'medium' | 'low'
  type: string
  description: string
}

export interface Supplier {
  name: string | null
  tin: string | null
  sst_number: string | null
}

export interface Amount {
  subtotal: number | null
  sst_amount: number | null
  total: number | null
}

export interface AgentResult {
  doc_type: string | null
  date: string | null
  supplier: Supplier
  amount: Amount
  tax_treatment: string | null
  confidence: number | null
  risk_flags: RiskFlag[]
  reasoning: string | null
  thinking_steps?: Array<{
    step?: number
    type?: string
    action?: string
    input?: Record<string, unknown>
    output?: string
  }>
}

export interface TaxDocument {
  id: string
  filename?: string
  file_url?: string
  ocr_text?: string
  supplier_name?: string | null
  doc_type?: string | null
  total_amount?: number | null
  tax_treatment?: string | null
  confidence?: number | null
  risk_count?: number
  status: string
  client_id?: string | null
  client_email?: string | null
  company_name?: string | null
  reviewed_by?: string | null
  review_action?: string | null
  signed_by?: string | null
  signed_at?: string | null
  created_at: string
  updated_at?: string
  agent_result?: AgentResult
}

export interface ProcessResponse {
  success: boolean
  document_id?: string
  error?: string
  data?: AgentResult
}

export interface UserInfo {
  id: string
  email: string
  role: 'client' | 'accountant'
  phone_number?: string | null
  // Client fields
  company_name?: string | null
  tin_number?: string | null
  business_sector?: string | null
  // Accountant fields
  name?: string | null
  ic_number?: string | null
  expertise_areas?: string[]
}

export interface CompanyProfile {
  companyName: string
  tin: string
  ssmNo: string
  sstNo: string
  turnoverBand: string
  industry: string
}

export interface OwnerAuth {
  email: string
  password: string
  companyProfile: CompanyProfile
}

export interface AccountantAuth {
  email: string
  password: string
}

export interface DocumentReviewPayload {
  tax_treatment: string
  total_amount: number
  supplier_name?: string
  action: 'approve' | 'save'
}

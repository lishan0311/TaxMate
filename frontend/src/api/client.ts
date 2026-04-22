import axios from 'axios'
import type { DocumentReviewPayload, ProcessResponse, UserInfo } from '../types'

const api = axios.create({ baseURL: '/api' })

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taxmate_token')
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  user: UserInfo
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await api.post('/auth/login', payload)
  return res.data
}

export async function registerClient(payload: {
  email: string
  password: string
  company_name: string
  tin_number: string
  business_sector: string
  phone_number?: string
}): Promise<AuthResponse> {
  const res = await api.post('/auth/register/client', payload)
  return res.data
}

export async function registerAccountant(payload: {
  email: string
  password: string
  name: string
  ic_number: string
  expertise_areas: string[]
  phone_number?: string
}): Promise<AuthResponse> {
  const res = await api.post('/auth/register/accountant', payload)
  return res.data
}

export async function updateProfile(payload: {
  company_name?: string
  tin_number?: string
  business_sector?: string
  phone_number?: string
  name?: string
  ic_number?: string
  expertise_areas?: string[]
}): Promise<UserInfo> {
  const res = await api.put('/auth/profile', payload)
  return res.data
}

export async function getMe(): Promise<UserInfo> {
  const res = await api.get('/auth/me')
  return res.data
}

export async function getAccountants(sector?: string): Promise<{ accountants: unknown[] }> {
  const res = await api.get('/auth/accountants', { params: sector ? { sector } : undefined })
  return res.data
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function processText(ocrText: string): Promise<ProcessResponse> {
  const res = await api.post('/documents/process-text', { ocr_text: ocrText })
  return res.data
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ProcessResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/documents/upload', form, {
    onUploadProgress: (event) => {
      if (!event.total || !onProgress) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return res.data
}

export async function uploadFilesInBatch(
  files: File[],
  onFileProgress: (filename: string, progress: number) => void,
): Promise<Array<{ file: string; result: ProcessResponse }>> {
  const results: Array<{ file: string; result: ProcessResponse }> = []
  for (const file of files) {
    const result = await uploadFile(file, (progress) => onFileProgress(file.name, progress))
    results.push({ file: file.name, result })
  }
  return results
}

export async function getDocuments(status?: string): Promise<{ count: number; documents: unknown[] }> {
  const res = await api.get('/documents', { params: status ? { status } : undefined })
  return res.data
}

export async function getDocument(id: string): Promise<unknown> {
  const res = await api.get(`/documents/${id}`)
  return res.data
}

export async function approveDocument(id: string): Promise<unknown> {
  const res = await api.post(`/documents/${id}/approve`)
  return res.data
}

export async function rejectDocument(id: string): Promise<unknown> {
  const res = await api.post(`/documents/${id}/reject`)
  return res.data
}

export async function reviewDocument(id: string, payload: DocumentReviewPayload): Promise<unknown> {
  const res = await api.put(`/documents/${id}/review`, payload)
  return res.data
}

export async function getBatchAnalysis(): Promise<unknown> {
  const res = await api.get('/documents/batch-analysis')
  return res.data
}

export async function exportSst02(year: number, month: number, isDraft = false): Promise<Blob> {
  const res = await api.get('/documents/export-sst02', {
    params: { year, month, is_draft: isDraft },
    responseType: 'blob',
  })
  return res.data
}

export async function deleteDocument(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/documents/${id}`)
  return res.data
}

export async function getTaxAdvice(): Promise<{
  advice: Array<{ type: string; title: string; detail: string; priority: string }>
  summary: string
  disclaimer: string
  generated_at?: string
}> {
  const res = await api.get('/documents/tax-advice')
  return res.data
}

export async function getClientsList(): Promise<{
  clients: Array<{
    client_id: string
    client_email: string
    company_name: string
    pending_count: number
    total_count: number
  }>
}> {
  const res = await api.get('/documents/clients')
  return res.data
}

export async function submitPeriod(year: number, month: number): Promise<{ submitted: number; message: string }> {
  const res = await api.post('/documents/submit-period', { year, month })
  return res.data
}

export async function signSst02(payload: {
  signature_data: string
  year: number
  month: number
  client_id?: string
}): Promise<{ success: boolean; message: string; pdf_base64: string; client_email: string; signed_by: string }> {
  const res = await api.post('/documents/sign-sst02', payload)
  return res.data
}

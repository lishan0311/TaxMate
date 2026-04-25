import { useEffect, useMemo, useState } from 'react'

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '- ')
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      return row.split('|').map((c: string) => c.trim()).filter(Boolean).join(': ')
    })
}
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  approveDocument,
  chatWithAgent,
  getDocument,
  getDocuments,
  getWorkflowNextStep,
  getReviewBrief,
  rejectDocument,
  reviewDocument,
  signSst02,
} from '../../api/client'
import type { TaxDocument } from '../../types'
import SignaturePad from '../../components/SignaturePad'
import { useAuth } from '../../context/AuthContext'
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  PenLine,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  MailCheck,
  FileCheck2,
} from 'lucide-react'

// --- Top navigation and operation area ---
const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C"

// ── helpers ───────────────────────────────────────────────────────────────────

function confidenceBadge(c: number | null | undefined) {
  const v = c ?? 0
  if (v >= 0.85) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{(v * 100).toFixed(0)}% High</span>
  if (v >= 0.65) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{(v * 100).toFixed(0)}% Med</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{(v * 100).toFixed(0)}% Low</span>
}

function isAutoApprovable(doc: TaxDocument): boolean {
  const conf = doc.confidence ?? doc.agent_result?.confidence ?? 0
  const risks = doc.risk_count ?? doc.agent_result?.risk_flags?.length ?? 0
  return conf >= 0.85 && risks === 0
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AccountantWorkbench() {
  const { id: rawParamId } = useParams()
  const paramId = rawParamId === '_' ? undefined : rawParamId
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useAuth() 

  const clientId = searchParams.get('client') ?? undefined
  const [queue, setQueue] = useState<TaxDocument[]>([])
  const [queueIdx, setQueueIdx] = useState(0)

  const [doc, setDoc] = useState<TaxDocument | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [taxTreatment, setTaxTreatment] = useState('input_tax_claimable')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [auditTrail, setAuditTrail] = useState<Array<{ at: string; action: string }>>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [workflowRec, setWorkflowRec] = useState<string | null>(null)
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [workflowSteps, setWorkflowSteps] = useState<Array<{ step: number; type: string; action: string }>>([])
  const [showSigPad, setShowSigPad] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signedPdfB64, setSignedPdfB64] = useState<string | null>(null)
  const [clientNotified, setClientNotified] = useState(false)
  const [notifiedEmail, setNotifiedEmail] = useState('')
  const [reviewBrief, setReviewBrief] = useState('')
  const [briefLoading, setBriefLoading] = useState(false)
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [aiApprovedCount, setAiApprovedCount] = useState(0)

  // ── load queue ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getDocuments()
      .then((data) => {
        const all = data.documents as TaxDocument[]
        let scoped = clientId ? all.filter((d) => d.client_id === clientId) : all
        const aiApproved = scoped.filter((d) => d.review_action === 'ai_approved')
        setAiApprovedCount(aiApproved.length)
        let pending = scoped.filter((d) =>
          d.status === 'pending_review' || d.review_action === 'ai_approved',
        )
        pending.sort((a, b) => {
          const ra = a.risk_count ?? 0
          const rb = b.risk_count ?? 0
          if (rb !== ra) return rb - ra
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        setQueue(pending)
      })
      .catch(() => {})
  }, [clientId])

  useEffect(() => {
    setBriefLoading(true)
    getReviewBrief({ year: 2026, month: 4, client_id: clientId })
      .then((res) => setReviewBrief(res.brief))
      .catch(() => setReviewBrief('AI review brief is unavailable now.'))
      .finally(() => setBriefLoading(false))
  }, [clientId])

  const docId = paramId ?? queue[queueIdx]?.id

  useEffect(() => {
    if (!docId) return
    getDocument(docId)
      .then((data) => {
        const d = data as TaxDocument
        setDoc(d)
        setSupplierName(d.agent_result?.supplier?.name ?? d.supplier_name ?? '')
        setTotalAmount(d.agent_result?.amount?.total ?? d.total_amount ?? 0)
        setTaxTreatment(d.agent_result?.tax_treatment ?? d.tax_treatment ?? 'input_tax_claimable')
      })
      .catch(() => setDoc(null))
  }, [docId])

  function pushTrail(action: string) {
    setAuditTrail((prev) => [{ at: new Date().toLocaleString(), action }, ...prev])
  }

  async function saveReview() {
    if (!docId) return
    setSaving(true)
    setSaveSuccess(false)
    await reviewDocument(docId, {
      supplier_name: supplierName,
      total_amount: totalAmount,
      tax_treatment: taxTreatment,
      action: 'save',
    })
    pushTrail('Saved review changes')
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function approveOne(id: string) {
    await approveDocument(id)
    setQueue((prev) => prev.filter((d) => d.id !== id))
    if (doc?.id === id) {
      setDoc((prev) => prev ? { ...prev, status: 'approved' } : prev)
    }
    pushTrail(`Approved: ${id.slice(0, 8)}…`)
  }

  async function rejectOne() {
    if (!docId) return
    await rejectDocument(docId)
    setDoc((prev) => prev ? { ...prev, status: 'rejected' } : prev)
    setQueue((prev) => prev.filter((d) => d.id !== docId))
    pushTrail('Rejected document')
  }

  async function oneClickApproveAll() {
    const autoList = queue.filter(isAutoApprovable)
    if (autoList.length === 0) return
    setSaving(true)
    for (const d of autoList) {
      await approveDocument(d.id)
      pushTrail(`Auto-approved: ${d.supplier_name || d.id.slice(0, 8)}`)
    }
    setQueue((prev) => prev.filter((d) => !autoList.some((a) => a.id === d.id)))
    setSaving(false)
  }

  async function handleSign(signatureDataUrl: string) {
    setShowSigPad(false)
    setSigning(true)
    try {
      const res = await signSst02({
        signature_data: signatureDataUrl,
        year: 2026,
        month: 4,
        client_id: clientId,
      })
      setSignedPdfB64(res.pdf_base64)
      setClientNotified(true)
      setNotifiedEmail(res.client_email)
      pushTrail(`Signed SST-02 — notification sent to ${res.client_email}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      alert(e.response?.data?.detail || 'Signing failed. Ensure all receipts are approved first.')
    } finally {
      setSigning(false)
    }
  }

  async function askAi() {
    if (!chatQuestion.trim()) return
    const userQ = chatQuestion.trim()
    setChatHistory(prev => [...prev, { role: 'user', content: userQ }])
    setChatQuestion('')
    setChatLoading(true)
    try {
      const res = await chatWithAgent({
        question: userQ,
        year: 2026,
        month: 4,
        client_id: clientId,
      })
      setChatHistory(prev => [...prev, { role: 'ai', content: res.answer }])
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', content: 'AI assistant is temporarily unavailable. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  async function askWorkflowNext() {
    setWorkflowLoading(true)
    setWorkflowRec(null)
    setWorkflowSteps([])
    try {
      const res = await getWorkflowNextStep('continue')
      setWorkflowRec(res.recommendation)
      setWorkflowSteps(res.thinking_steps?.filter((s: { type: string }) => s.type === 'orchestrator_decision') || [])
    } catch {
      setWorkflowRec('AI Orchestrator is temporarily unavailable. Please try again shortly.')
    } finally {
      setWorkflowLoading(false)
    }
  }

  const flags = useMemo(() => doc?.agent_result?.risk_flags ?? [], [doc])
  const thinkingSteps = useMemo(() => doc?.agent_result?.thinking_steps ?? [], [doc])
  const autoApprovableCount = useMemo(() => queue.filter(isAutoApprovable).length, [queue])
  const allApproved = queue.every((d) => d.review_action === 'ai_approved' || d.status === 'approved') || queue.length === 0

  if (clientNotified) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-6">
        <div className="inline-flex p-6 bg-emerald-50 rounded-full shadow-inner">
          <MailCheck size={48} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">Review Complete!</h2>
          <p className="text-slate-500 mt-2">
            The signed SST-02 has been emailed to your client at<br />
            <span className="font-bold text-indigo-600">{notifiedEmail}</span>
          </p>
        </div>
        {signedPdfB64 && (
          <a
            href={`data:application/pdf;base64,${signedPdfB64}`}
            download="SST-02_Signed.pdf"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-black transition-all shadow-xl"
          >
            <FileCheck2 size={18} /> Download Signed PDF
          </a>
        )}
        <button
          onClick={() => navigate('/accountant/clients')}
          className="block mx-auto text-sm text-slate-400 hover:text-slate-600 underline"
        >
          Back to Clients
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" style={{ fontFamily: FONT_BODY }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: FONT_DISPLAY }}>Review Workbench</h1>
          <p className="text-sm font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
            {queue.length > 0 ? `${queue.length} receipts pending review` : 'All receipts processed'}
            {aiApprovedCount > 0 && <span className="text-emerald-500 ml-2">• {aiApprovedCount} AI auto-approved</span>}
          </p>
        </div>

        {autoApprovableCount > 0 && (
          <button
            onClick={() => void oneClickApproveAll()}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Zap size={16} />
            Auto-Approve {autoApprovableCount} High-Confidence Receipt{autoApprovableCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <section className="bg-white border border-blue-50 rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Accountant Briefing</h2>
          <button
            onClick={() => void askWorkflowNext()}
            disabled={workflowLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#F5A623', color: '#fff', boxShadow: '0 4px 12px rgba(245,166,35,0.3)' }}
          >
            {workflowLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {workflowLoading ? 'Analyzing...' : 'Analyze Workflow'}
          </button>
        </div>
        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed italic">
          {briefLoading ? 'Generating AI summary…' : (reviewBrief || 'No AI brief available.')}
        </p>

        {/* Workflow progress bar */}
        {(() => {
          const stages = [
            { key: 'INTAKE', label: 'Upload' },
            { key: 'ANALYSIS', label: 'AI Analysis' },
            { key: 'REVIEW_PREP', label: 'Review' },
            { key: 'FILING', label: 'Filing' },
            { key: 'COMPLETE', label: 'Done' },
          ]
          const stageOrder = ['INTAKE', 'ANALYSIS', 'REVIEW_PREP', 'AWAITING_REVIEW', 'FILING', 'NOTIFICATION', 'COMPLETE']
          const currentStage = workflowRec
            ? (workflowSteps.some(s => s.action?.includes('batch_analysis')) ? 'ANALYSIS'
              : workflowSteps.some(s => s.action?.includes('brief')) ? 'REVIEW_PREP'
              : workflowSteps.some(s => s.action?.includes('filing')) ? 'FILING'
              : workflowSteps.some(s => s.action?.includes('notification')) ? 'FILING'
              : 'ANALYSIS')
            : (queue.length === 0 && aiApprovedCount === 0 ? 'INTAKE'
              : queue.length === 0 ? 'COMPLETE'
              : 'REVIEW_PREP')
          const currentIdx = Math.max(0, stageOrder.indexOf(currentStage))

          return (
            <div className="flex items-center gap-0 pt-2">
              {stages.map((stage, i) => {
                const stageIdx = stageOrder.indexOf(stage.key)
                const isDone = stageIdx < currentIdx || (stage.key === 'COMPLETE' && currentStage === 'COMPLETE')
                const isCurrent = stage.key === currentStage || (stage.key === 'REVIEW_PREP' && currentStage === 'AWAITING_REVIEW') || (stage.key === 'FILING' && currentStage === 'NOTIFICATION')
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all"
                        style={{
                          background: isDone ? '#22c55e' : isCurrent ? '#F5A623' : '#E2E8F0',
                          color: '#fff',
                          boxShadow: isCurrent ? '0 0 0 3px rgba(245,166,35,0.2)' : 'none',
                        }}
                      >
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isDone ? 'text-emerald-600' : isCurrent ? 'text-amber-600' : 'text-slate-400'}`}>
                        {stage.label}
                      </span>
                    </div>
                    {i < stages.length - 1 && (
                      <div className="h-0.5 flex-1 -mt-4" style={{ background: isDone ? '#22c55e' : '#E2E8F0' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {workflowRec && !workflowLoading && (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FDE68A' }}>
            <Zap size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 leading-relaxed">{workflowRec}</p>
          </div>
        )}
      </section>

      {/* ── Queue strip ── */}
      {queue.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {queue.map((d, i) => {
            const isAiApproved = d.review_action === 'ai_approved'
            return (
            <button
              key={d.id}
              onClick={() => setQueueIdx(i)}
              className={`shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-bold transition-all shadow-sm ${
                i === queueIdx
                  ? 'bg-[#0A3D7C] text-white border-[#0A3D7C] shadow-lg shadow-blue-900/30 translate-y-[-2px]'
                  : isAiApproved
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                  : 'bg-white text-slate-600 border-blue-50 hover:border-blue-200'
              }`}
            >
              {isAiApproved && <ShieldCheck size={14} className={i === queueIdx ? 'text-emerald-300' : 'text-emerald-500'} />}
              {(d.risk_count ?? 0) > 0 && !isAiApproved && <AlertTriangle size={14} className={i === queueIdx ? 'text-amber-300' : 'text-amber-500'} />}
              {isAutoApprovable(d) && !isAiApproved && <Zap size={14} className={i === queueIdx ? 'text-emerald-300' : 'text-emerald-400'} />}
              <span className="max-w-[140px] truncate">{d.supplier_name || `Receipt ${i + 1}`}</span>
            </button>
            )
          })}
        </div>
      )}

      {/* ── Three-column workbench ── */}
      {doc && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Col 1: Original */}
          <section className="bg-white border border-blue-50 rounded-[2rem] p-6 space-y-4 transition-all" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Original Receipt</h2>
            {doc.file_url ? (
              <img
                src={doc.file_url}
                alt="Receipt"
                className="w-full rounded-[1.5rem] object-contain max-h-80 border border-slate-100 shadow-inner cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setLightbox(doc.file_url!)}
              />
            ) : (
              <div className="h-48 bg-slate-50 rounded-2xl grid place-items-center text-slate-400 text-sm border border-dashed border-slate-200">
                No image available
              </div>
            )}
            <pre className="text-[11px] bg-slate-50 p-4 rounded-2xl whitespace-pre-wrap text-slate-500 max-h-40 overflow-y-auto border border-slate-100 font-mono leading-relaxed">
              {doc.ocr_text ?? '—'}
            </pre>
          </section>

          {/* Col 2: Editable fields */}
          <section className="bg-white border border-blue-50 rounded-[2rem] p-6 space-y-5 transition-all" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Extraction</h2>
              <div className="flex items-center gap-2">
                {confidenceBadge(doc.agent_result?.confidence ?? doc.confidence)}
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${
                  doc.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  doc.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                  'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {doc.status}
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Supplier Name</label>
                <input
                  className="w-full border border-blue-50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50/50 text-slate-700"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Total Amount (RM)</label>
                <input
                  className="w-full border border-blue-50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50/50 text-slate-700"
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tax Treatment</label>
                <select
                  className="w-full border border-blue-50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50/50 text-slate-700 cursor-pointer"
                  value={taxTreatment}
                  onChange={(e) => setTaxTreatment(e.target.value)}
                >
                  <option value="input_tax_claimable">Input Tax — Claimable</option>
                  <option value="input_tax_not_claimable">Input Tax — Not Claimable</option>
                  <option value="output_tax">Output Tax</option>
                  <option value="personal_expense">Personal Expense</option>
                  <option value="unclear">Unclear</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => void saveReview()}
              disabled={saving || saveSuccess}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-900/20'
                  : 'bg-slate-900 text-white hover:bg-black shadow-slate-900/20'
              }`}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saveSuccess ? <CheckCircle2 size={16} /> : null}
              {saveSuccess ? 'Changes Saved!' : 'Save Changes'}
            </button>
            {saveSuccess && (
              <p className="text-center text-emerald-600 text-xs font-bold mt-1">Review changes saved successfully.</p>
            )}
          </section>

          {/* Col 3: Reasoning & Risk */}
          <section className="bg-white border border-blue-50 rounded-[2rem] p-6 space-y-5 transition-all overflow-y-auto max-h-[600px]" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Reasoning & Risk</h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {doc.agent_result?.reasoning ?? 'No reasoning returned.'}
            </p>

            {flags.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">Risk Flags</h3>
                {flags.map((flag, idx) => (
                  <div
                    key={`${flag.type}-${idx}`}
                    className={`flex gap-3 p-4 rounded-2xl border text-sm ${
                      flag.severity === 'high'
                        ? 'bg-red-50 border-red-100 text-red-700'
                        : flag.severity === 'medium'
                        ? 'bg-amber-50 border-amber-100 text-amber-700'
                        : 'bg-slate-50 border-slate-100 text-slate-600'
                    }`}
                  >
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-[10px] uppercase tracking-wider">[{flag.severity}] {flag.type}</p>
                      <p className="text-xs mt-1 font-medium">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {thinkingSteps.length > 0 && (
              <div className="space-y-3 border-t border-blue-50 pt-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Agent Steps</h3>
                {thinkingSteps.map((step, idx) => (
                  <div
                    key={`${step.step ?? idx}-${step.action ?? 'a'}`}
                    className="bg-slate-50/50 rounded-xl p-3 text-[11px] border border-blue-50 font-medium"
                  >
                    <p className="text-slate-800">
                      <span className="text-[#0A3D7C] font-black">Step {step.step ?? idx + 1}:</span> {step.action ?? step.type ?? 'analysis'}
                    </p>
                    {step.output && <p className="text-slate-400 mt-1 italic leading-tight">{step.output}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Action bar ── */}
      {doc && (
        <div className="bg-white border border-blue-50 rounded-[2rem] p-6 flex flex-wrap gap-4 items-center" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          {doc.review_action === 'ai_approved' ? (
            <span className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest">
              <ShieldCheck size={16} />
              AI Auto-Approved
            </span>
          ) : (
            <button
              onClick={() => void approveOne(doc.id)}
              disabled={doc.status === 'approved'}
              className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-40 shadow-xl shadow-emerald-900/20"
            >
              <CheckCircle2 size={16} />
              Approve
            </button>
          )}
          <button
            onClick={() => void rejectOne()}
            disabled={doc.status === 'rejected'}
            className="flex items-center gap-2 bg-red-500 text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-40 shadow-xl shadow-red-900/20"
          >
            <XCircle size={16} />
            Reject
          </button>

          {queue.length > 1 && (
            <div className="flex items-center gap-3 ml-auto bg-slate-50 px-4 py-2 rounded-2xl border border-blue-50 shadow-inner">
              <button
                onClick={() => setQueueIdx((i) => Math.max(0, i - 1))}
                disabled={queueIdx === 0}
                className="p-2 bg-white rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all border border-blue-50 shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-slate-500 tabular-nums">{queueIdx + 1} / {queue.length}</span>
              <button
                onClick={() => setQueueIdx((i) => Math.min(queue.length - 1, i + 1))}
                disabled={queueIdx === queue.length - 1}
                className="p-2 bg-white rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all border border-blue-50 shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Sign & finalise ── */}
      {allApproved && (
        <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 border border-indigo-100 rounded-[2.5rem] p-10 space-y-6" style={{ boxShadow: '0 20px 60px rgba(10,61,124,0.15)' }}>
          <div className="flex items-center gap-5">
            <div className="bg-white p-4 rounded-[1.5rem] shadow-xl shadow-indigo-900/10 border border-indigo-50">
              <ShieldCheck size={32} className="text-[#0A3D7C]" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800" style={{ fontFamily: FONT_DISPLAY }}>All Receipts Reviewed</h3>
              <p className="text-sm text-slate-500 font-medium">
                Sign the SST-02 to generate the official PDF and notify your client.
              </p>
            </div>
          </div>

          {!showSigPad && (
            <button
              onClick={() => setShowSigPad(true)}
              disabled={signing}
              className="flex items-center gap-3 bg-[#0A3D7C] text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-[0.98] shadow-2xl shadow-blue-900/40"
            >
              {signing ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
              {signing ? 'Generating signed PDF…' : 'Sign SST-02 Form'}
            </button>
          )}

          {showSigPad && (
            <div className="p-4 bg-white rounded-[2rem] shadow-2xl border border-indigo-50">
              <SignaturePad
                onConfirm={(dataUrl) => void handleSign(dataUrl)}
                onCancel={() => setShowSigPad(false)}
              />
            </div>
          )}
        </div>
      )}

      <section className="bg-white border border-blue-50 rounded-[2rem] p-7 space-y-4" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ask AI About This Batch</h2>
        
        {chatHistory.length > 0 && (
          <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-3 scrollbar-thin">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`text-sm px-5 py-3 rounded-2xl max-w-[80%] font-medium ${
                  msg.role === 'user'
                    ? 'bg-[#0A3D7C] text-white rounded-br-none shadow-lg shadow-blue-900/20'
                    : 'bg-slate-50 text-slate-700 rounded-bl-none border border-blue-50 shadow-sm whitespace-pre-wrap'
                }`}>
                  {msg.role === 'ai' ? stripMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <input
            value={chatQuestion}
            onChange={(e) => setChatQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void askAi();
              }
            }}
            placeholder="e.g. Why is this supplier high risk?"
            className="flex-1 border border-blue-50 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50 shadow-inner"
          />
          <button
            onClick={() => void askAi()}
            disabled={chatLoading || !chatQuestion.trim()}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all hover:bg-black shadow-lg"
          >
            {chatLoading ? <Loader2 size={16} className="animate-spin" /> : 'Ask'}
          </button>
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Receipt enlarged"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
          >
            <XCircle size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
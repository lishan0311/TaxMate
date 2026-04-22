import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  approveDocument,
  getDocument,
  getDocuments,
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
  useAuth() // token attached globally via axios interceptor

  // When navigated from Queue, a client_id may be in the query
  const clientId = searchParams.get('client') ?? undefined

  // Queue of all docs for this client that need review
  const [queue, setQueue] = useState<TaxDocument[]>([])
  const [queueIdx, setQueueIdx] = useState(0)

  // Currently displayed doc (either from param or queue)
  const [doc, setDoc] = useState<TaxDocument | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [taxTreatment, setTaxTreatment] = useState('input_tax_claimable')

  const [saving, setSaving] = useState(false)
  const [auditTrail, setAuditTrail] = useState<Array<{ at: string; action: string }>>([])

  // Signature flow
  const [showSigPad, setShowSigPad] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signedPdfB64, setSignedPdfB64] = useState<string | null>(null)
  const [clientNotified, setClientNotified] = useState(false)
  const [notifiedEmail, setNotifiedEmail] = useState('')

  // ── load queue ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getDocuments()
      .then((data) => {
        const all = data.documents as TaxDocument[]
        let pending = all.filter((d) =>
          d.status === 'processed' || d.status === 'pending_review',
        )
        if (clientId) {
          pending = pending.filter((d) => d.client_id === clientId)
        }
        // Sort: high risk first, then by date
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

  // ── load single doc ─────────────────────────────────────────────────────────
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

  // ── actions ─────────────────────────────────────────────────────────────────

  async function saveReview() {
    if (!docId) return
    setSaving(true)
    await reviewDocument(docId, {
      supplier_name: supplierName,
      total_amount: totalAmount,
      tax_treatment: taxTreatment,
      action: 'save',
    })
    pushTrail('Saved review changes')
    setSaving(false)
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

  // ── derived state ────────────────────────────────────────────────────────────

  const flags = useMemo(() => doc?.agent_result?.risk_flags ?? [], [doc])
  const thinkingSteps = useMemo(() => doc?.agent_result?.thinking_steps ?? [], [doc])
  const autoApprovableCount = useMemo(() => queue.filter(isAutoApprovable).length, [queue])
  const allApproved = queue.length === 0

  // ── render ───────────────────────────────────────────────────────────────────

  if (clientNotified) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-6">
        <div className="inline-flex p-6 bg-emerald-50 rounded-full">
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
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-black transition-all"
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Review Workbench</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {queue.length > 0
              ? `${queue.length} receipt(s) pending review`
              : 'All receipts processed'}
          </p>
        </div>

        {autoApprovableCount > 0 && (
          <button
            onClick={() => void oneClickApproveAll()}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Zap size={16} />
            Auto-Approve {autoApprovableCount} High-Confidence Receipt{autoApprovableCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Queue strip ── */}
      {queue.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {queue.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setQueueIdx(i)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                i === queueIdx
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {(d.risk_count ?? 0) > 0 && <AlertTriangle size={13} className={i === queueIdx ? 'text-amber-300' : 'text-amber-500'} />}
              {isAutoApprovable(d) && <Zap size={13} className={i === queueIdx ? 'text-emerald-300' : 'text-emerald-500'} />}
              <span className="max-w-[120px] truncate">{d.supplier_name || `Receipt ${i + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Three-column workbench ── */}
      {doc && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Col 1: Original */}
          <section className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Original Receipt</h2>
            {doc.file_url ? (
              <img
                src={doc.file_url}
                alt="Receipt"
                className="w-full rounded-xl object-contain max-h-80 border border-slate-100"
              />
            ) : (
              <div className="h-48 bg-slate-50 rounded-xl grid place-items-center text-slate-400 text-sm border border-dashed border-slate-200">
                No image available
              </div>
            )}
            <pre className="text-xs bg-slate-50 p-3 rounded-xl whitespace-pre-wrap text-slate-600 max-h-40 overflow-y-auto border border-slate-100">
              {doc.ocr_text ?? '—'}
            </pre>
          </section>

          {/* Col 2: Editable fields */}
          <section className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Extraction</h2>
              <div className="flex items-center gap-2">
                {confidenceBadge(doc.agent_result?.confidence ?? doc.confidence)}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {doc.status}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Supplier Name</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Total Amount (RM)</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tax Treatment</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
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
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Changes
            </button>
          </section>

          {/* Col 3: Reasoning & Risk */}
          <section className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm overflow-y-auto max-h-[600px]">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Reasoning & Risk</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {doc.agent_result?.reasoning ?? 'No reasoning returned.'}
            </p>

            {flags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Risk Flags</h3>
                {flags.map((flag, idx) => (
                  <div
                    key={`${flag.type}-${idx}`}
                    className={`flex gap-2 p-3 rounded-xl border text-sm ${
                      flag.severity === 'high'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : flag.severity === 'medium'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">[{flag.severity.toUpperCase()}] {flag.type}</p>
                      <p className="text-xs mt-0.5">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {thinkingSteps.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agent Steps</h3>
                {thinkingSteps.map((step, idx) => (
                  <div
                    key={`${step.step ?? idx}-${step.action ?? 'a'}`}
                    className="bg-slate-50 rounded-xl p-3 text-xs border border-slate-100"
                  >
                    <p className="font-bold text-slate-700">
                      Step {step.step ?? idx + 1}: {step.action ?? step.type ?? 'analysis'}
                    </p>
                    {step.output && <p className="text-slate-500 mt-1">{step.output}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Action bar ── */}
      {doc && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-wrap gap-3 items-center shadow-sm">
          <button
            onClick={() => void approveOne(doc.id)}
            disabled={doc.status === 'approved'}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-40"
          >
            <CheckCircle2 size={16} />
            Approve
          </button>
          <button
            onClick={() => void rejectOne()}
            disabled={doc.status === 'rejected'}
            className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-40"
          >
            <XCircle size={16} />
            Reject
          </button>

          {/* Queue navigation */}
          {queue.length > 1 && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setQueueIdx((i) => Math.max(0, i - 1))}
                disabled={queueIdx === 0}
                className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-500">{queueIdx + 1} / {queue.length}</span>
              <button
                onClick={() => setQueueIdx((i) => Math.min(queue.length - 1, i + 1))}
                disabled={queueIdx === queue.length - 1}
                className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Sign & finalise ── */}
      {allApproved && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-indigo-100">
              <ShieldCheck size={22} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">All Receipts Reviewed</h3>
              <p className="text-sm text-slate-500">
                Sign the SST-02 to generate the official PDF and notify your client.
              </p>
            </div>
          </div>

          {!showSigPad && (
            <button
              onClick={() => setShowSigPad(true)}
              disabled={signing}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-sm shadow-indigo-200"
            >
              {signing ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
              {signing ? 'Generating signed PDF…' : 'Sign SST-02 Form'}
            </button>
          )}

          {showSigPad && (
            <SignaturePad
              onConfirm={(dataUrl) => void handleSign(dataUrl)}
              onCancel={() => setShowSigPad(false)}
            />
          )}
        </div>
      )}

      {/* ── Audit trail ── */}
      {auditTrail.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Audit Trail</h2>
          <ul className="space-y-1.5">
            {auditTrail.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-slate-300 shrink-0">{item.at}</span>
                <span>— {item.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

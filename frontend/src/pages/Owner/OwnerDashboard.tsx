// Fonts used: Playfair Display (headings) + Inter (body)
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDocuments, getWorkflowNextStep } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { TaxDocument } from '../../types'
import {
  Calendar,
  ChevronDown,
  Lock,
  Upload,
  Clock,
  TrendingUp,
  FileText,
  ShieldCheck,
  Loader2,
  Zap,
} from 'lucide-react'

type PeriodStatus = 'filed' | 'current' | 'upcoming';
interface Period {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  deadline: Date;
  status: PeriodStatus;
}

const PERIODS: Period[] = [
  { 
    id: '2026-Q3', label: 'May 2026 - Jun 2026', 
    startDate: new Date(2026, 4, 1), endDate: new Date(2026, 5, 30), 
    deadline: new Date(2026, 6, 31), status: 'upcoming' 
  },
  { 
    id: '2026-Q2', label: 'Mar 2026 - Apr 2026', 
    startDate: new Date(2026, 2, 1), endDate: new Date(2026, 3, 30), 
    deadline: new Date(2026, 4, 31), status: 'current' 
  },
  { 
    id: '2026-Q1', label: 'Jan 2026 - Feb 2026', 
    startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 28), 
    deadline: new Date(2026, 2, 31), status: 'filed' 
  },
];

function toAmount(value?: number | null): number { return value ?? 0; }
function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"

export default function OwnerDashboard() {
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [now, setNow] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[1]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [aiNextStep, setAiNextStep] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStructured, setAiStructured] = useState<{
    stage?: string; total_documents?: number; pending_review?: number;
    approved?: number; high_risk_count?: number; days_to_deadline?: number;
    deadline_urgency?: string;
  } | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const username = user?.company_name || user?.email?.split('@')[0] || 'Owner';

  useEffect(() => {
    getDocuments().then((data) => setDocs(data.documents as TaxDocument[])).catch(() => setDocs([]));
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      const docDate = new Date(d.created_at || '');
      return docDate >= selectedPeriod.startDate && docDate <= selectedPeriod.endDate;
    });
  }, [docs, selectedPeriod]);

  const isSubmitted = useMemo(() => {
    return filteredDocs.some((d) => ['pending_review', 'approved', 'signed'].includes(d.status));
  }, [filteredDocs]);

  const isLocked = useMemo(() => {
    return selectedPeriod.status === 'filed' || isSubmitted;
  }, [selectedPeriod, isSubmitted]);

  const summary = useMemo(() => {
    const inputTax = filteredDocs
      .filter((d) => d.tax_treatment?.includes('input_tax'))
      .reduce((sum, d) => sum + toAmount(d.total_amount), 0);
    const outputTax = filteredDocs
      .filter((d) => d.tax_treatment === 'output_tax')
      .reduce((sum, d) => sum + toAmount(d.total_amount), 0);
    return { inputTax, outputTax, count: filteredDocs.length };
  }, [filteredDocs]);

  const countdown = useMemo(() => {
    if (selectedPeriod.status !== 'current' || isLocked) return null;
    const diffMs = Math.max(0, selectedPeriod.deadline.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }, [selectedPeriod, now, isLocked]);

  async function askAiNextStep() {
    setAiLoading(true);
    setAiNextStep(null);
    setAiStructured(null);
    try {
      const res = await getWorkflowNextStep('continue');
      setAiNextStep(res.recommendation);
      setAiStructured((res as { structured?: typeof aiStructured }).structured || null);
    } catch {
      setAiNextStep('AI assistant is temporarily unavailable. Please try again shortly.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-8 pb-20" style={{ color: '#334155', fontFamily: FONT_BODY }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: '#0A3D7C', fontFamily: FONT_DISPLAY }}>
            Good day, <span className="italic" style={{ fontWeight: 600 }}>{username}</span>
          </h1>
          <p className="text-sm font-normal tracking-wide" style={{ color: '#64748b', fontFamily: FONT_BODY }}>
            Overview for{' '}
            <span className="font-semibold" style={{ color: '#F5A623' }}>{selectedPeriod.label}</span>
          </p>
        </div>

        {/* Period Picker */}
        <div className="relative">
          <button 
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className="w-full md:w-64 flex items-center justify-between bg-white px-5 py-3 rounded-xl transition-all active:scale-[0.98]"
            style={{ border: '1.5px solid #BFDBFE', boxShadow: '0 8px 24px rgba(10,61,124,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <Calendar size={18} style={{ color: '#378ADD' }} />
              <span className="text-sm font-medium tracking-wide" style={{ color: '#1e40af' }}>{selectedPeriod.label}</span>
            </div>
            <ChevronDown size={14} style={{ color: '#93c5fd' }} className={`transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPickerOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl z-50 p-2"
              style={{ border: '1px solid #DBEAFE', boxShadow: '0 12px 48px rgba(10,61,124,0.2)' }}
            >
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPeriod(p); setIsPickerOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all"
                  style={
                    selectedPeriod.id === p.id
                      ? { background: '#EFF6FF', color: '#1d4ed8' }
                      : { color: '#64748b' }
                  }
                  onMouseEnter={e => { if (selectedPeriod.id !== p.id) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFF' }}
                  onMouseLeave={e => { if (selectedPeriod.id !== p.id) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-widest opacity-50 mt-0.5">
                      {p.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Input Tax (Claimable)" value={`RM ${summary.inputTax.toFixed(2)}`} accent="blue" />
        <StatCard title="Output Tax (Payable)" value={`RM ${summary.outputTax.toFixed(2)}`} accent="orange" />
        <StatCard title="Total Records" value={String(summary.count)} accent="slate" />
      </div>

      {/* Action Banner */}
      <div
        className="rounded-3xl p-10 transition-all duration-700 relative overflow-hidden"
        style={
          isSubmitted
            ? { background: 'linear-gradient(135deg, #185FA5 0%, #1e70bf 60%, #2563EB 100%)', boxShadow: '0 12px 32px rgba(24,95,165,0.25)' }
            : selectedPeriod.status === 'filed'
            ? { background: 'linear-gradient(135deg, #0A3D7C 0%, #185FA5 60%, #22c55e11 100%)', border: '1.5px solid #DBEAFE', boxShadow: '0 12px 32px rgba(10,61,124,0.18)' }
            : { background: 'linear-gradient(135deg, #0A3D7C 0%, #185FA5 50%, #1e6fbe 100%)', boxShadow: '0 12px 32px rgba(10,61,124,0.2)' }
        }
      >
        <div
          className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full"
          style={{
            background: selectedPeriod.status === 'filed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,166,35,0.15)',
            transform: 'translate(30%, -30%)'
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.15em] bg-white/10 text-white border border-white/20">
              {isSubmitted ? 'Audit in Progress' : `${selectedPeriod.status} Phase`}
            </div>

            {selectedPeriod.status === 'current' && !isLocked && countdown ? (
              <div className="flex items-end justify-center lg:justify-start gap-6">
                <TimeBox value={countdown.days} unit="Days" />
                <TimeBox value={countdown.hours} unit="Hrs" />
                <TimeBox value={countdown.minutes} unit="Min" />
                <TimeBox value={countdown.seconds} unit="Sec" />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-4xl font-normal tracking-tight text-white" style={{ fontFamily: FONT_DISPLAY }}>
                   {isSubmitted ? 'Handed Over ' : 'Archive '}
                   <span className="italic font-semibold" style={{ color: isSubmitted ? '#F5A623' : '#86efac' }}>
                    {isSubmitted ? 'to Auditor' : 'Secured'}
                  </span>
                </p>
                <p className="text-sm font-light tracking-wide text-white/80">
                  {isSubmitted ? 'Verification typically takes 1–3 working days.' : 'Filing locked. Reference: MY-SST-2026-00812'}
                </p>
              </div>
            )}
            
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase italic text-white/90">
              Official Deadline: {formatDate(selectedPeriod.deadline)}
            </p>
          </div>

          <div className="w-full lg:w-auto">
            {selectedPeriod.status === 'filed' ? (
              <button 
                onClick={() => window.open('http://localhost:8000/api/documents/export-sst02?month=2', '_blank')}
                className="w-full lg:w-72 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-white"
                style={{ background: '#0A3D7C', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <FileText size={18} strokeWidth={1.5} />
                Download PDF
              </button>
            ) : (
              <button 
                disabled={isLocked}
                onClick={() => navigate('/owner/upload', { state: { periodId: selectedPeriod.id, periodLabel: selectedPeriod.label } })}
                className="w-full lg:w-72 font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={
                  isLocked
                    ? { background: '#0A3D7C', color: 'rgba(255,255,255,0.7)', cursor: 'not-allowed', border: '1.5px solid rgba(255,255,255,0.4)', opacity: 0.7, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }
                    : { background: '#F5A623', color: '#fff', boxShadow: '0 8px 32px rgba(245,166,35,0.4)', border: '1.5px solid rgba(255,255,255,0.2)' }
                }
              >
                {isLocked ? <Lock size={18} strokeWidth={1.5} /> : <Upload size={18} strokeWidth={1.5} />}
                {isSubmitted ? 'Locked for Audit' : selectedPeriod.status === 'current' ? 'Upload Receipt' : 'Pre-upload Data'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Workflow Advisor */}
      <div
        className="bg-white rounded-3xl p-8 border border-blue-100"
        style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-3" style={{ color: '#0A3D7C', fontFamily: FONT_DISPLAY }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F5A623' }}>
              <Zap size={16} className="text-white" />
            </div>
            AI Workflow
          </h2>
          <button
            onClick={() => void askAiNextStep()}
            disabled={aiLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#0A3D7C', color: '#fff', boxShadow: '0 4px 16px rgba(10,61,124,0.3)' }}
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {aiLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Progress steps */}
        {(() => {
          const stages = [
            { key: 'INTAKE', label: 'Upload', icon: Upload },
            { key: 'ANALYSIS', label: 'AI Analysis', icon: Zap },
            { key: 'REVIEW_PREP', label: 'Review', icon: ShieldCheck },
            { key: 'FILING', label: 'Filing', icon: FileText },
            { key: 'COMPLETE', label: 'Done', icon: ShieldCheck },
          ]
          const stageOrder = ['INTAKE', 'ANALYSIS', 'REVIEW_PREP', 'AWAITING_REVIEW', 'FILING', 'NOTIFICATION', 'COMPLETE']
          const currentStage = aiStructured?.stage
            || (docs.length === 0 ? 'INTAKE'
              : docs.some(d => d.status === 'signed') ? 'COMPLETE'
              : docs.some(d => d.status === 'approved') ? 'FILING'
              : docs.some(d => d.status === 'pending_review') ? 'REVIEW_PREP'
              : docs.some(d => d.status === 'processed') ? 'ANALYSIS'
              : 'INTAKE')

          return (
            <div className="flex items-center gap-0">
              {stages.map((stage, i) => {
                const stageIdx = stageOrder.indexOf(stage.key)
                const currentIdx = stageOrder.indexOf(currentStage)
                const isDone = stageIdx < currentIdx || (stage.key === 'COMPLETE' && currentStage === 'COMPLETE')
                const isCurrent = stage.key === currentStage || (stage.key === 'REVIEW_PREP' && currentStage === 'AWAITING_REVIEW') || (stage.key === 'FILING' && currentStage === 'NOTIFICATION')
                const IconComp = stage.icon
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isDone ? '#22c55e' : isCurrent ? '#F5A623' : '#E2E8F0',
                          boxShadow: isCurrent ? '0 0 0 4px rgba(245,166,35,0.2)' : 'none',
                        }}
                      >
                        {isDone
                          ? <ShieldCheck size={18} className="text-white" />
                          : isCurrent && aiLoading
                          ? <Loader2 size={16} className="text-white animate-spin" />
                          : <IconComp size={16} className="text-white" />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDone ? 'text-emerald-600' : isCurrent ? 'text-amber-600' : 'text-slate-400'}`}>
                        {stage.label}
                      </span>
                    </div>
                    {i < stages.length - 1 && (
                      <div className="h-0.5 flex-1 -mt-5" style={{ background: isDone ? '#22c55e' : '#E2E8F0' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Structured info cards */}
        {aiStructured && !aiLoading && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background: aiStructured.pending_review ? '#FEF3C7' : '#F0FDF4', border: `1px solid ${aiStructured.pending_review ? '#FDE68A' : '#BBF7D0'}` }}>
              <p className="text-2xl font-black" style={{ color: aiStructured.pending_review ? '#D97706' : '#16A34A' }}>{aiStructured.pending_review || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-500">Pending Review</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-2xl font-black text-emerald-600">{aiStructured.approved || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-500">Approved</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: aiStructured.days_to_deadline && aiStructured.days_to_deadline < 7 ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${aiStructured.days_to_deadline && aiStructured.days_to_deadline < 7 ? '#FECACA' : '#BFDBFE'}` }}>
              <p className="text-2xl font-black" style={{ color: aiStructured.days_to_deadline && aiStructured.days_to_deadline < 7 ? '#DC2626' : '#2563EB' }}>{aiStructured.days_to_deadline ?? '-'}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-500">Days to Deadline</p>
            </div>
          </div>
        )}

        {/* AI recommendation - short */}
        {aiNextStep && !aiLoading && (
          <div className="mt-4 p-4 rounded-xl flex items-start gap-3" style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FDE68A' }}>
            <Zap size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 leading-relaxed">{aiNextStep}</p>
          </div>
        )}

        {!aiNextStep && !aiLoading && (
          <p className="mt-4 text-sm text-slate-400 text-center">Click Analyze to check your current workflow status</p>
        )}
      </div>

      {/* Recent Transactions */}
      <div
        className="bg-white rounded-3xl p-8 border border-blue-100"
        style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold flex items-center gap-3" style={{ color: '#0A3D7C', fontFamily: FONT_DISPLAY }}>
            <div className="w-2.5 h-2.5 rounded-full bg-[#F5A623] shadow-[0_0_10px_rgba(245,166,35,0.5)]" />
            Recent Transactions
          </h2>
          <Link
            to="/owner/documents"
            className="text-[10px] font-bold uppercase tracking-widest text-[#378ADD] hover:text-[#0A3D7C] transition-colors"
          >
            View All Records
          </Link>
        </div>

        <div className="space-y-1">
          {filteredDocs.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-5 rounded-2xl transition-all border border-transparent hover:border-blue-50 hover:bg-blue-50/30"
            >
              <div className="flex items-center gap-6">
                <FileText size={20} className="text-blue-200 group-hover:text-blue-400 transition-colors" />
                <div>
                  <p className="text-sm font-semibold tracking-tight text-slate-800">
                    {doc.supplier_name || 'Processing AI...'}
                  </p>
                  <p className="text-[10px] font-normal uppercase tracking-widest mt-0.5 text-slate-400">
                    {doc.tax_treatment?.replace('_', ' ')} • {formatDate(new Date(doc.created_at || ''))}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-semibold tracking-tight text-[#0A3D7C]">
                  RM {toAmount(doc.total_amount).toFixed(2)}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[9px] font-medium uppercase text-slate-400 tracking-tighter">
                    {doc.status}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${doc.status === 'approved' ? '' : 'animate-pulse'}`}
                    style={{ background: doc.status === 'approved' ? '#22c55e' : '#F5A623' }}
                  />
                </div>
              </div>
            </div>
          ))}
          
          {filteredDocs.length === 0 && (
            <div className="py-20 text-center uppercase tracking-[0.2em] text-slate-300 text-xs italic">
              No records in this environment
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function StatCard({ title, value, accent }: { title: string; value: string; accent: 'blue' | 'orange' | 'slate' }) {
  const accentColor = accent === 'blue' ? '#378ADD' : accent === 'orange' ? '#F5A623' : '#64748b'
  const topBorderColor = accent === 'blue' ? '#BFDBFE' : accent === 'orange' ? '#FDE68A' : '#e2e8f0'

  return (
    <div
      className="bg-white rounded-2xl p-7 transition-all hover:shadow-2xl hover:-translate-y-1 border border-blue-50"
      style={{
        borderTop: `4px solid ${topBorderColor}`,
        boxShadow: '0 10px 24px rgba(10,61,124,0.12)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-slate-400">
        {title}
      </p>
      <p className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
        {value}
      </p>
    </div>
  )
}

function TimeBox({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <p className="text-4xl font-bold text-white tabular-nums tracking-tighter" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        {String(value).padStart(2, '0')}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] mt-3 text-white/60">
        {unit}
      </p>
    </div>
  )
}
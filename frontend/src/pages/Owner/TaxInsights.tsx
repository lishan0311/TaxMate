// Fonts used: Playfair Display (headings) + Inter (body/numbers)
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDocuments, getBatchAnalysis, exportSst02 } from '../../api/client'
import type { TaxDocument } from '../../types'
import {
  BarChart3,
  PieChart,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Loader2,
  ChevronDown
} from 'lucide-react'

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C"
const COLOR_ACCENT = "#F5A623"  

interface TaxInsightsProps {
  role?: 'owner' | 'accountant'
}

type PeriodStatus = 'filed' | 'current' | 'upcoming' | 'all'
interface Period {
  id: string
  label: string
  startDate?: Date
  endDate?: Date
  status: PeriodStatus
}

const PERIODS: Period[] = [
  { id: 'all', label: 'All Periods (2026)', status: 'all' },
  {
    id: '2026-Q3', label: 'May 2026 - Jun 2026',
    startDate: new Date(2026, 4, 1), endDate: new Date(2026, 5, 30),
    status: 'upcoming'
  },
  {
    id: '2026-Q2', label: 'Mar 2026 - Apr 2026',
    startDate: new Date(2026, 2, 1), endDate: new Date(2026, 3, 30),
    status: 'current'
  },
  {
    id: '2026-Q1', label: 'Jan 2026 - Feb 2026',
    startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 28),
    status: 'filed'
  },
]

export default function TaxInsights({ role = 'owner' }: TaxInsightsProps) {
  const [docs, setDocs] = useState<TaxDocument[]>([])
  const [batchAnalysis, setBatchAnalysis] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[2])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const navigate = useNavigate()
  const isAccountant = role === 'accountant'

  useEffect(() => {
    let isMounted = true
    const loadData = async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const [docData, analysisData] = await Promise.all([
          getDocuments(),
          getBatchAnalysis(),
        ])
        if (!isMounted) return
        setDocs(docData.documents as TaxDocument[])
        setBatchAnalysis(analysisData)
      } catch {
        if (!isMounted) return
        setDocs([]); setBatchAnalysis(null)
      } finally {
        if (showLoading && isMounted) setLoading(false)
      }
    }
    void loadData(true)
    return () => { isMounted = false }
  }, [])

  const filteredDocs = useMemo(() => {
    if (selectedPeriod.id === 'all') return docs
    return docs.filter(d => {
      const docDate = new Date(d.created_at || '')
      return docDate >= selectedPeriod.startDate! && docDate <= selectedPeriod.endDate!
    })
  }, [docs, selectedPeriod])

  const stats = useMemo(() => {
    const validStatus = isAccountant ? ['approved', 'signed'] : ['processed', 'pending_review', 'approved', 'signed'];
    const activeDocs = filteredDocs.filter(d => validStatus.includes(d.status || ''));
    
    const outputTax = activeDocs
      .filter(d => (d.tax_treatment || d.agent_result?.tax_treatment) === 'output_tax')
      .reduce((s, d) => {
        const sst = d.agent_result?.amount?.sst_amount;
        const total = d.total_amount || d.agent_result?.amount?.total || 0;
        return s + (typeof sst === 'number' ? sst : total * 0.06);
      }, 0);

    const inputTaxPaid = activeDocs
      .filter(d => (d.tax_treatment || d.agent_result?.tax_treatment)?.includes('input_tax'))
      .reduce((s, d) => s + (d.agent_result?.amount?.sst_amount || 0), 0);

    const avgConfidence = filteredDocs.length === 0 ? 1 :
      filteredDocs.reduce((s, d) => s + (d.confidence || d.agent_result?.confidence || 0.8), 0) / filteredDocs.length;
    const totalRisks = filteredDocs.reduce((s, d) => s + (d.risk_count || 0), 0);
    const complianceScore = Math.max(0, Math.min(100, Math.round(avgConfidence * 100 - Math.min(totalRisks * 5, 40))));

    return { inputTaxPaid, outputTax, netPayable: outputTax, complianceScore, total: activeDocs.length };
  }, [filteredDocs, isAccountant]);

  const monthlyTrend = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map(month => {
      const tax = docs.filter(d => {
        const date = new Date(d.created_at || '')
        return date.getFullYear() === 2026 && date.getMonth() + 1 === month
      }).filter(d => (d.tax_treatment || d.agent_result?.tax_treatment) === 'output_tax' && (isAccountant ? d.status === 'approved' : true))
        .reduce((s, d) => s + (d.agent_result?.amount?.sst_amount || 0), 0)
      return { month, tax }
    })
  }, [docs, isAccountant])

  const maxTax = Math.max(...monthlyTrend.map(m => m.tax), 1)

  const expenseAllocation = useMemo(() => {
    const total = filteredDocs.length || 1
    const receipt = filteredDocs.filter(d => (d.doc_type || d.agent_result?.doc_type) === 'receipt').length
    const b2b = filteredDocs.filter(d => (d.doc_type || d.agent_result?.doc_type) === 'b2b_invoice').length
    const other = Math.max(0, total - receipt - b2b)
    return [
      { label: 'Receipts', stroke: '#378ADD', pct: Math.round((receipt / total) * 100) },
      { label: 'B2B Invoice', stroke: '#BFDBFE', pct: Math.round((b2b / total) * 100) },
      { label: 'Others', stroke: '#E2E8F0', pct: Math.round((other / total) * 100) },
    ]
  }, [filteredDocs])

  const aiAdvice = useMemo(() => {
    if (batchAnalysis?.tax_tips?.length > 0) return batchAnalysis.tax_tips[0].description
    if (filteredDocs.length === 0) return "No documents uploaded yet. Upload receipts to begin intelligence analysis."
    return "Period data is verified and compliant. SST-02 preparation is optimal."
  }, [batchAnalysis, filteredDocs])

  async function handleExport() {
    setExporting(true)
    try {
      const isDraftMode = !isAccountant;
      const year = 2026;
      let month = selectedPeriod.id === '2026-Q1' ? 2 : selectedPeriod.id === '2026-Q3' ? 6 : 4;
      const blob = await exportSst02(year, month, isDraftMode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `SST-02_Report.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { alert(`Export Failed`); } finally { setExporting(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={42} /></div>

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-8 pb-48" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
            Tax Insights
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Financial Intelligence & Compliance</p>
        </div>

        <div className="relative">
          <div className="bg-white border border-blue-100 pl-4 pr-10 py-2.5 rounded-xl shadow-sm flex items-center gap-2">
            <Filter size={14} className="text-blue-300" />
            <select
              value={selectedPeriod.id}
              onChange={(e) => setSelectedPeriod(PERIODS.find(p => p.id === e.target.value) || PERIODS[2])}
              className="appearance-none bg-transparent border-none outline-none text-sm font-semibold text-[#0A3D7C] cursor-pointer"
            >
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300" size={14} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <InsightCard title="NET SST PAYABLE" value={`RM ${stats.netPayable.toFixed(2)}`} trend={stats.netPayable > 0 ? "Due" : "Nil"} isPositive={stats.netPayable === 0} accent="blue" />
        <InsightCard title="OUTPUT TAX" value={`RM ${stats.outputTax.toFixed(2)}`} trend="Sales" isPositive={false} accent="orange" />
        <InsightCard title="INPUT TAX (PAID)" value={`RM ${stats.inputTaxPaid.toFixed(2)}`} trend="Expenses" isPositive={true} accent="blue" />
        <InsightCard title="COMPLIANCE" value={`${stats.complianceScore}%`} trend={stats.complianceScore > 80 ? "Healthy" : "Low"} isPositive={stats.complianceScore > 80} accent="slate" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart */}
        <div className="bg-white p-8 rounded-3xl border border-blue-50" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-10">Output Tax Trend (2026)</h3>
          <div className="h-48 flex items-end justify-between gap-4 px-2">
            {monthlyTrend.map((m, i) => (
              <div key={i} className="flex-1 relative">
                <div 
                  style={{ height: `${Math.max((m.tax/maxTax)*100, 4)}%` }} 
                  className={`w-full rounded-t-md ${m.tax > 0 ? 'bg-[#0A3D7C]' : 'bg-slate-100'}`} 
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-bold">M{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white p-8 rounded-3xl border border-blue-50" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-10">Document Allocation</h3>
          <div className="flex items-center gap-16">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f8fafc" strokeWidth="4" />
                {expenseAllocation.map((item, i) => {
                  const offset = expenseAllocation.slice(0, i).reduce((s, a) => s + a.pct, 0);
                  return <circle key={i} cx="18" cy="18" r="15.9" fill="transparent" stroke={item.stroke} strokeWidth="4" strokeDasharray={`${item.pct} 100`} strokeDashoffset={-offset} />
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold text-[#0A3D7C]" style={{ fontFamily: FONT_BODY }}>{stats.total}</span>
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Docs</span>
              </div>
            </div>
            <div className="space-y-4">
              {expenseAllocation.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.stroke }} />
                  <span className="text-[11px] font-bold text-slate-500 min-w-24 uppercase">{item.label}</span>
                  <span className="text-[11px] font-bold text-slate-900" style={{ fontFamily: FONT_BODY }}>{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Block */}
      <div className="bg-[#0A3D7C] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10 flex items-start gap-8">
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-xl border border-white/10">
            <TrendingUp size={32} className="text-[#F5A623]" />
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">AI Tax Advisor Insights</h4>
            <p className="text-xl font-normal leading-relaxed italic" style={{ fontFamily: FONT_DISPLAY }}>"{aiAdvice}"</p>
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-6xl bg-[#0A3D7C]/95 backdrop-blur-xl text-white rounded-[2rem] p-8 flex items-center justify-between z-50 border border-white/10" style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div className="flex gap-16 items-center px-6">
          <div>
            <p className="text-[10px] text-blue-300/60 uppercase font-bold tracking-[0.2em] leading-none">Total Documents</p>
            <p className="text-3xl font-bold mt-2 tabular-nums" style={{ fontFamily: FONT_BODY }}>{stats.total}</p>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <p className="text-[10px] text-blue-300/60 uppercase font-bold tracking-[0.2em] leading-none">Est. Net Payable</p>
            <p className="text-3xl font-bold text-blue-400 mt-2 tabular-nums" style={{ fontFamily: FONT_BODY }}>
              <span className="text-sm mr-1 opacity-50 font-medium">RM</span>
              {stats.netPayable.toFixed(2)}
            </p>
          </div>
        </div>

        <button
          onClick={isAccountant ? () => navigate('/accountant/workbench') : handleExport}
          disabled={exporting}
          className="bg-[#F5A623] hover:bg-[#ffb433] text-white px-12 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl shadow-orange-900/40 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {isAccountant ? 'Go to Workbench' : exporting ? 'Exporting...' : 'Download SST-02 Draft'}
        </button>
      </div>
    </div>
  )
}

function InsightCard({ title, value, trend, isPositive, accent }: any) {
  const accentColor = accent === 'blue' ? '#378ADD' : accent === 'orange' ? '#F5A623' : '#64748B'
  const topBorderColor = accent === 'blue' ? '#BFDBFE' : accent === 'orange' ? '#FDE68A' : '#E2E8F0'

  return (
    <div 
      className="bg-white rounded-2xl p-7"
      style={{
        border: '1.5px solid #DBEAFE',
        borderTop: `3px solid ${topBorderColor}`,
        boxShadow: '0 8px 25px rgba(10,61,124,0.12)',
      }}
    >
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">{title}</p>
      <p className="text-2xl font-bold mb-2" style={{ color: accentColor, fontFamily: FONT_BODY }}>{value}</p>
      <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPositive ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {trend}
      </div>
    </div>
  )
}
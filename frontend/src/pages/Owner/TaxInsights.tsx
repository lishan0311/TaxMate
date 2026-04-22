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
  Loader2
} from 'lucide-react'

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
        setDocs([])
        setBatchAnalysis(null)
      } finally {
        if (showLoading && isMounted) setLoading(false)
      }
    }

    void loadData(true)
    const timer = window.setInterval(() => { void loadData(false) }, 15000)
    const onFocus = () => { void loadData(false) }
    window.addEventListener('focus', onFocus)

    return () => {
      isMounted = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
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
    const riskPenalty = Math.min(totalRisks * 5, 40);
    const complianceScore = Math.max(0, Math.min(100, Math.round(avgConfidence * 100 - riskPenalty)));

    return { inputTaxPaid, outputTax, netPayable: outputTax, complianceScore, total: activeDocs.length };
  }, [filteredDocs, isAccountant]);

  const monthlyTrend = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map(month => {
      const monthDocs = docs.filter(d => {
        const date = new Date(d.created_at || '')
        return date.getFullYear() === 2026 && date.getMonth() + 1 === month
      })
      const tax = monthDocs
        .filter(d => (d.tax_treatment || d.agent_result?.tax_treatment) === 'output_tax' && (isAccountant ? d.status === 'approved' : true))
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
      { label: 'Receipts', color: 'bg-indigo-500', stroke: '#6366f1', pct: Math.round((receipt / total) * 100) },
      { label: 'B2B Invoice', color: 'bg-indigo-200', stroke: '#c7d2fe', pct: Math.round((b2b / total) * 100) },
      { label: 'Others', color: 'bg-slate-100', stroke: '#e2e8f0', pct: Math.round((other / total) * 100) },
    ]
  }, [filteredDocs])

  const aiAdvice = useMemo(() => {
    if (batchAnalysis?.tax_tips?.length > 0) return batchAnalysis.tax_tips[0].description
    if (filteredDocs.length === 0) return "No documents uploaded yet. Upload receipts to begin intelligence analysis."
    const missingSSTCount = filteredDocs.filter(d => {
      const res = d.agent_result as any;
      return !(res?.supplier?.sst_number || res?.supplier?.sst_no || res?.sst_no);
    }).length
    if (missingSSTCount > 0) {
      return `AI detected ${missingSSTCount} document(s) with missing or unverified SST registration numbers. Ensure suppliers are legitimate to claim compliance.`
    }
    return "Period data is verified and compliant. SST-02 preparation is optimal."
  }, [batchAnalysis, filteredDocs])

  async function handleExport() {
    setExporting(true)
    try {
      const isDraftMode = !isAccountant;
      const year = 2026;
      let monthToExport = 4; 
      if (selectedPeriod.id === '2026-Q1') monthToExport = 2;
      if (selectedPeriod.id === '2026-Q3') monthToExport = 6;
      const blob = await exportSst02(year, monthToExport, isDraftMode);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SST-02_${year}_M${monthToExport-1}_M${monthToExport}_${isDraftMode ? 'DRAFT' : 'SIGNED'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export Error:", err);
      let serverMsg = "Please upload and process receipts first, then try again."
      if (err.response?.data instanceof Blob) {
        try { const t = await err.response.data.text(); serverMsg = JSON.parse(t).detail || serverMsg } catch {}
      } else {
        serverMsg = err.response?.data?.detail || err.message || serverMsg
      }
      alert(`Export Failed: ${serverMsg}`);
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={42} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-8 pb-32 font-sans text-slate-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tax Insights</h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">FINANCIAL INTELLIGENCE & COMPLIANCE</p>
        </div>

        <div className="flex items-center gap-3 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
          <Filter size={16} className="ml-3 text-slate-400" />
          <select
            value={selectedPeriod.id}
            onChange={(e) => setSelectedPeriod(PERIODS.find(p => p.id === e.target.value) || PERIODS[2])}
            className="bg-transparent border-none outline-none text-sm font-medium pr-8 py-2 cursor-pointer text-slate-700"
          >
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <InsightCard title="NET SST PAYABLE" value={`RM ${stats.netPayable.toFixed(2)}`} trend={stats.netPayable > 0 ? "Nil" : "Nil"} isPositive={stats.netPayable === 0} />
        <InsightCard title="OUTPUT TAX" value={`RM ${stats.outputTax.toFixed(2)}`} trend="Sales Collection" isPositive={false} />
        <InsightCard title="INPUT TAX (PAID)" value={`RM ${stats.inputTaxPaid.toFixed(2)}`} trend="Non-claimable" isPositive={true} />
        <InsightCard title="COMPLIANCE" value={`${stats.complianceScore}%`} trend={stats.complianceScore > 80 ? "Healthy" : "Low"} isPositive={stats.complianceScore > 80} />
      </div>

      {/* Analytics Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
            <BarChart3 size={16} className="text-indigo-500" /> Output Tax Trend (2026)
          </h3>
          <div className="h-48 flex items-end justify-between gap-3 px-2">
            {monthlyTrend.map((m, i) => (
              <div key={i} className="flex-1 group relative">
                <div 
                  style={{ height: `${Math.max((m.tax/maxTax)*100, 4)}%` }} 
                  className={`w-full rounded-t-sm transition-all duration-700 ${m.tax > 0 ? 'bg-indigo-500' : 'bg-slate-50 border-x border-t border-slate-100'}`} 
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-bold">M{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-8 text-[11px] uppercase tracking-wider">
            <PieChart size={16} className="text-indigo-500" /> Document Allocation
          </h3>
          <div className="flex items-center gap-12">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                {expenseAllocation.map((item, i) => {
                  const offset = expenseAllocation.slice(0, i).reduce((s, a) => s + a.pct, 0);
                  return <circle key={i} cx="18" cy="18" r="15.9" fill="transparent" stroke={item.stroke} strokeWidth="4" strokeDasharray={`${item.pct} 100`} strokeDashoffset={-offset} />
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
                <span className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">Docs</span>
              </div>
            </div>
            <div className="space-y-3">
              {expenseAllocation.map((item, i) => (
                <LegendItem key={i} label={item.label} color={item.color} percentage={`${item.pct}%`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Intelligence Block */}
      <div className="bg-indigo-600 rounded-4xl p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10 flex items-start gap-8">
          <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-xl border border-white/10 shadow-xl">
            <TrendingUp size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold tracking-tight uppercase text-indigo-50">AI Tax Advisor Insights</h4>
            <p className="text-indigo-50 text-sm font-medium leading-relaxed max-w-3xl">
              "{aiAdvice}"
            </p>
          </div>
        </div>
      </div>

      {/* Floating Dark Action Bar (针对图片风格) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-5xl bg-[#0b1220] p-6 rounded-3xl shadow-2xl flex items-center justify-between z-50">
        <div className="flex items-center gap-8 px-4 border-r border-slate-800 mr-8">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Documents</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="px-8 border-l border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Est. Net Payable</p>
            <p className="text-2xl font-bold text-[#4589ff]">RM {stats.netPayable.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-6">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <ShieldCheck size={18} />
             </div>
             <div>
                <p className="text-[10px] font-bold text-white uppercase tracking-tighter">SST-02 Ready</p>
                <p className="text-[9px] text-slate-500 font-medium">Draft Period: {selectedPeriod.label}</p>
             </div>
          </div>
          
          <button
            onClick={isAccountant ? () => navigate('/accountant/workbench') : handleExport}
            disabled={exporting}
            className="bg-[#2463eb] text-white px-10 py-4 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-blue-700 transition-all active:scale-95 shadow-xl disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isAccountant ? 'Go to Workbench' : exporting ? 'Exporting...' : 'Download Unsigned Draft'}
          </button>
        </div>
      </div>

    </div>
  )
}

function InsightCard({ title, value, trend, isPositive }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-200 group">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 group-hover:text-indigo-400 transition-colors">{title}</p>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isPositive ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {trend}
      </div>
    </div>
  )
}

function LegendItem({ label, color, percentage }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[11px] font-bold text-slate-500 min-w-20">{label}</span>
      <span className="text-[11px] font-black text-slate-900">{percentage}</span>
    </div>
  )
}
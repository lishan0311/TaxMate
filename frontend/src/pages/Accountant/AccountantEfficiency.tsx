import { useEffect, useMemo, useState } from 'react'
import { getDocuments, getClientsList } from '../../api/client'
import { getAccountantClients } from '../../lib/storage'
import type { TaxDocument } from '../../types'
import {
  PieChart,
  BarChart3,
  Users,
  Banknote,
  Zap,
  Loader2,
  TrendingUp,
  FileChartColumn,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react'

// --- Font and Color Constants ---
const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623" 

export default function AccountantEfficiency() {
  const [docs, setDocs] = useState<TaxDocument[]>([])
  const [clientsCount, setClientsCount] = useState(() => getAccountantClients().length)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDocuments().then(data => data.documents as TaxDocument[]).catch(() => []),
      getClientsList().then(data => data.clients.length).catch(() => getAccountantClients().length)
    ]).then(([docsData, cCount]) => {
      setDocs(docsData)
      setClientsCount(cCount)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  const metrics = useMemo(() => {
    const reviewed = docs.filter((d) => d.status === 'approved' || d.status === 'rejected' || d.status === 'signed').length
    const clients = clientsCount
    const estimatedIncome = clients * 1200
    const traditionalHours = reviewed * 0.75
    const assistedHours = reviewed * 0.25
    return { reviewed, clients, estimatedIncome, traditionalHours, assistedHours }
  }, [docs, clientsCount])

  const timeAllocation = useMemo(() => {
    const total = metrics.traditionalHours || 1;
    const savingPct = Math.round(((metrics.traditionalHours - metrics.assistedHours) / total) * 100);
    return [
      { label: 'Time Saved', stroke: '#22c55e', pct: savingPct },
      { label: 'AI Review Time', stroke: '#BFDBFE', pct: 100 - savingPct },
    ]
  }, [metrics])

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={42} /></div>

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-8 pb-32" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-blue-50 pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
            Efficiency <span className="italic">Portfolio</span>
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
            Performance & Productivity AI Insights
          </p>
        </div>
        <div className="flex items-center gap-3 bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100" style={{ boxShadow: '0 4px 12px rgba(10,61,124,0.06)' }}>
          <TrendingUp size={16} className="text-[#22c55e]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A3D7C]">Real-time Performance Sync</span>
        </div>
      </div>

      {/* Stats Cards - Deepen Shading */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <InsightCard 
          icon={<FileChartColumn size={24} />}
          title="REVIEWS THIS MONTH" 
          value={String(metrics.reviewed)} 
          trend="Processed Docs"
          accent="blue"
        />
        <InsightCard 
          icon={<Users size={24} />}
          title="TOTAL CLIENTS" 
          value={String(metrics.clients)} 
          trend="Active Portfolio"
          accent="orange"
        />
        <InsightCard 
          icon={<Banknote size={24} />}
          title="ESTIMATED INCOME" 
          value={`RM ${metrics.estimatedIncome}`} 
          trend="Monthly Revenue"
          accent="blue"
        />
      </div>

      {/* Analytics Visuals -Deepen the shadows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Bar Chart */}
        <div className="lg:col-span-7 bg-white p-10 rounded-3xl border border-blue-50 transition-all" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-12 ml-1">Assisted Review Trajectory</h3>
          <div className="h-48 flex items-end justify-between gap-4 px-2">
            {[1, 2, 3, 4, 5, 6].map(m => (
              <div key={m} className="flex-1 relative">
                <div 
                  style={{ height: `${6 + m * (100 / 6)}%` }} 
                  className="w-full rounded-t-lg bg-[#0A3D7C] shadow-sm shadow-blue-900/10" 
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-bold">M{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="lg:col-span-5 bg-white p-10 rounded-3xl border border-blue-50 transition-all" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-12 ml-1">Time Saving (v.s. Traditional)</h3>
          <div className="flex flex-col items-center gap-10">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f8fafc" strokeWidth="4" />
                {timeAllocation.map((item, i) => {
                  const offset = timeAllocation.slice(0, i).reduce((s, a) => s + a.pct, 0);
                  return <circle key={i} cx="18" cy="18" r="15.9" fill="transparent" stroke={item.stroke} strokeWidth="4" strokeDasharray={`${item.pct} 100`} strokeDashoffset={-offset} />
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold text-[#0A3D7C]" style={{ fontFamily: FONT_BODY }}>{metrics.assistedHours.toFixed(1)}</span>
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mt-1 text-center leading-tight">Assisted<br/>Hours</span>
              </div>
            </div>
            <div className="w-full">
               <div className="bg-blue-50/50 p-4 rounded-2xl text-center border border-blue-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Traditional Time (Est.)</p>
                  <p className="text-xl font-bold text-[#0A3D7C] tabular-nums" style={{ fontFamily: FONT_BODY }}>{metrics.traditionalHours.toFixed(1)} hrs</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Block - Enhance overall projection */}
      <div className="bg-[#0A3D7C] rounded-[2.5rem] p-10 text-white relative overflow-hidden transition-all hover:translate-y-[-2px]" style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10 flex items-start gap-8">
          <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-xl border border-white/10 text-[#F5A623] shadow-lg">
            <Zap size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">AI Productivity Insights</h4>
            <p className="text-xl font-normal leading-relaxed italic pr-10" style={{ fontFamily: FONT_DISPLAY }}>
              "Based on {metrics.reviewed} document reviews, TaxMate has successfully reduced your administrative workload by <span style={{ color: COLOR_ACCENT }}>{(metrics.traditionalHours - metrics.assistedHours).toFixed(1)} hours</span>. Maintain current review status to optimize client portfolio health."
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

function InsightCard({ icon, title, value, trend, accent }: any) {
  const accentColor = accent === 'blue' ? '#378ADD' : '#F5A623'
  const topBorderColor = accent === 'blue' ? '#BFDBFE' : '#FDE68A'

  return (
    <div 
      className="bg-white p-8 rounded-3xl transition-all hover:border-blue-200 hover:-translate-y-1"
      style={{
        border: '1.5px solid #DBEAFE',
        borderTop: `4px solid ${topBorderColor}`,
        boxShadow: '0 12px 40px rgba(10,61,124,0.12)'
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-blue-50 shadow-inner" style={{ color: accentColor }}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">{title}</p>
      <p className="text-3xl font-bold mb-2 tabular-nums" style={{ color: COLOR_PRIMARY, fontFamily: FONT_BODY }}>{value}</p>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
        <ArrowUpRight size={14} className="text-blue-300" /> {trend}
      </div>
    </div>
  )
}
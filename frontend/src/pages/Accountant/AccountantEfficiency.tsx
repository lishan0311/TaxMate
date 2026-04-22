import { useEffect, useMemo, useState } from 'react'
import { getDocuments } from '../../api/client'
import { getAccountantClients } from '../../lib/storage'
import type { TaxDocument } from '../../types'
import {
  PieChart,
  BarChart3,
  Timer,
  Users,
  Banknote,
  ShieldCheck,
  Zap,
  Loader2,
  TrendingUp,
  FileChartColumn, // 添加这个
  ArrowUpRight
} from 'lucide-react'

export default function AccountantEfficiency() {
  const [docs, setDocs] = useState<TaxDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDocuments()
      .then((data) => setDocs(data.documents as TaxDocument[]))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  // --- 核心计算逻辑：严格保持不变 ---
  const metrics = useMemo(() => {
    const reviewed = docs.filter((d) => d.status === 'approved' || d.status === 'rejected').length
    const clients = getAccountantClients().length
    // 每个客户 RM 1200
    const estimatedIncome = clients * 1200
    // 传统方式每张单 0.75 小时
    const traditionalHours = reviewed * 0.75
    // AI 辅助方式每张单 0.25 小时
    const assistedHours = reviewed * 0.25
    return { reviewed, clients, estimatedIncome, traditionalHours, assistedHours }
  }, [docs])

  // --- 用于 Pie Chart 的分布数据 ---
  const timeAllocation = useMemo(() => {
    const total = metrics.traditionalHours || 1;
    const savingPct = Math.round(((metrics.traditionalHours - metrics.assistedHours) / total) * 100);
    
    return [
      { label: 'Time Saved', color: 'bg-emerald-500', stroke: '#10b981', pct: savingPct },
      { label: 'AI Review Time', color: 'bg-emerald-200', stroke: '#a7f3d0', pct: 100 - savingPct },
    ]
  }, [metrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] bg-slate-50/50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-8 font-sans text-slate-700 animate-in fade-in duration-1000">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-light text-slate-900 tracking-tight">
            Accountant <span className="font-medium">Efficiency</span> Dashboard
          </h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Performance & Productivity AI Insights</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <TrendingUp size={16} className="text-emerald-500" />
          Real-time Performance Sync
        </div>
      </div>

      {/* Stats Cards (对应图片第一排) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InsightCard 
          icon={<FileChartColumn size={24} />}
          title="Reviews This Month" 
          value={String(metrics.reviewed)} 
          trend="Processed Docs"
          color="blue"
        />
        <InsightCard 
          icon={<Users size={24} />}
          title="Total Clients" 
          value={String(metrics.clients)} 
          trend="Active Portfolio"
          color="indigo"
        />
        <InsightCard 
          icon={<Banknote size={24} />}
          title="Estimated Income" 
          value={`RM ${metrics.estimatedIncome}`} 
          trend="Monthly Revenue"
          color="emerald"
        />
      </div>

      {/* Analytics Visuals (对应图片第二排) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧：Bar Chart (演示 AI 辅助后的时间轨迹) */}
        <div className="lg:col-span-7 bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-sm transition-all hover:shadow-md group">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-10 text-[11px] uppercase tracking-wider">
            <BarChart3 size={16} className="text-blue-500" /> Assisted Review Trajectory
          </h3>
          <div className="h-48 flex items-end justify-between gap-3 px-2">
            {[1, 2, 3, 4, 5, 6].map(m => (
              <div key={m} className="flex-1 group relative">
                <div 
                  style={{ height: `${6 + m * (100 / 6)}%` }} // 演示用，强制递增高度
                  className={`w-full rounded-t-xl transition-all duration-1000 bg-blue-500 shadow-lg group-hover:bg-blue-600 shadow-blue-100`} 
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-bold uppercase">M{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：Pie Chart (关键修改：直观展示时间节省) */}
        <div className="lg:col-span-5 bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-sm transition-all hover:shadow-md">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-10 text-[11px] uppercase tracking-wider">
            <PieChart size={16} className="text-emerald-500" /> Time Saving (v.s. Traditional)
          </h3>
          <div className="flex flex-col items-center gap-10">
            <div className="relative w-40 h-40 flex-shrink-0 transform hover:scale-110 transition-transform">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                {timeAllocation.map((item, i) => {
                  const offset = timeAllocation.slice(0, i).reduce((s, a) => s + a.pct, 0);
                  return <circle key={i} cx="18" cy="18" r="15.9" fill="transparent" stroke={item.stroke} strokeWidth="4" strokeDasharray={`${item.pct} 100`} strokeDashoffset={-offset} />
                })}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-black text-slate-800 tracking-tighter">{metrics.assistedHours.toFixed(1)}</span>
                <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Assisted Hrs</span>
              </div>
            </div>
            <div className="space-y-4 w-full">
               <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Traditional Time (Est.)</p>
                  <p className="text-lg font-extrabold text-slate-700">{metrics.traditionalHours.toFixed(1)} hrs</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Intelligence Block (对应图片深色底部栏) */}
      <div className="bg-emerald-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-200 mt-12">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10 flex items-start gap-8">
          <div className="bg-white/20 p-5 rounded-3xl backdrop-blur-xl border border-white/10 shadow-xl text-white">
            <Zap size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold tracking-tight uppercase text-emerald-50">AI Productivity Insights</h4>
            <p className="text-emerald-50 text-sm font-medium leading-relaxed max-w-4xl italic">
              "Based on {metrics.reviewed} document reviews, TaxMate has successfully reduced your administrative workload by <b>{(metrics.traditionalHours - metrics.assistedHours).toFixed(1)} hours</b>. Your effective hourly rate for these tasks has increased. Maintain current review status to optimize client portfolio health."
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

// 辅助子组件：Insight Card (Glassmorphism 风格)
function InsightCard({ icon, title, value, trend, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600 text-blue-50 shadow-blue-100',
    indigo: 'bg-indigo-600 text-indigo-50 shadow-indigo-100',
    emerald: 'bg-emerald-600 text-emerald-50 shadow-emerald-100',
  }
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md group">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl ${colors[color]} group-hover:scale-110 transition-transform duration-500`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{title}</p>
      <p className="text-3xl font-black text-slate-900 mb-1 tracking-tighter">{value}</p>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
        <ArrowUpRight size={14} /> {trend}
      </div>
    </div>
  )
}
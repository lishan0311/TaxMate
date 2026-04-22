import { useEffect, useState } from 'react'
import { getTaxAdvice } from '../api/client'
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
} from 'lucide-react'

interface Advice {
  type: string
  title: string
  detail: string
  priority: string
}

interface TaxAdviceData {
  advice: Advice[]
  summary: string
  disclaimer: string
  generated_at?: string
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  savings: {
    icon: <TrendingUp size={16} />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  action: {
    icon: <Lightbulb size={16} />,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  info: {
    icon: <Info size={16} />,
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  general: {
    icon: <Shield size={16} />,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
}

export default function TaxPlanningAdvice() {
  const [data, setData] = useState<TaxAdviceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)

  useEffect(() => {
    getTaxAdvice()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 animate-pulse">
        <div className="h-5 bg-slate-100 rounded w-48 mb-3" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (!data || data.advice.length === 0) return null

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-indigo-100">
            <Sparkles size={18} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-800">AI Tax Planning Suggestions</h3>
            <p className="text-xs text-slate-500 mt-0.5">{data.summary}</p>
          </div>
        </div>
        <div className="text-slate-400">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="p-5 space-y-3">
          {data.advice.map((item, idx) => {
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info
            return (
              <div
                key={idx}
                className={`flex gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}
              >
                <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${cfg.color}`}>{item.title}</p>
                    {item.priority === 'high' && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
                        High Priority
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            )
          })}

          {/* Disclaimer toggle */}
          <div className="mt-2">
            <button
              onClick={() => setDisclaimerOpen(!disclaimerOpen)}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
            >
              <Shield size={11} />
              Important Disclaimer
              {disclaimerOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {disclaimerOpen && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800 leading-relaxed">{data.disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

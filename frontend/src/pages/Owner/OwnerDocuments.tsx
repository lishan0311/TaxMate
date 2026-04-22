import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDocuments, deleteDocument, submitPeriod } from '../../api/client'
import type { TaxDocument } from '../../types'
import { 
  Search, 
  Send, 
  Clock, 
  Lock, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  FileArchive
} from 'lucide-react'

// --- 1. 马来西亚 SST 账期配置 ---
type PeriodStatus = 'filed' | 'current' | 'upcoming';
interface Period {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
}

const PERIODS: Period[] = [
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
];

const statusLabels: Record<string, string> = {
  processed: 'Processing',
  pending_review: 'Pending Review',
  approved: 'Signed',
  error: 'Exception',
  rejected: 'Rejected'
};

export default function OwnerDocuments() {
  const [docs, setDocs] = useState<TaxDocument[]>([])
  const [query, setQuery] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[1]) // 默认 Q2
  const [isSubmitted, setIsSubmitted] = useState(false)

  // 初始化加载
  useEffect(() => {
    getDocuments()
      .then((data) => {
        const loaded = data.documents as TaxDocument[]
        setDocs(loaded)
        // If any doc in current period is already past "processed", treat as submitted
        const currentPeriod = PERIODS[1]
        const periodDocs = loaded.filter(d => {
          const dt = new Date(d.created_at || '')
          return dt >= currentPeriod.startDate && dt <= currentPeriod.endDate
        })
        if (periodDocs.some(d => ['pending_review', 'approved', 'signed'].includes(d.status))) {
          setIsSubmitted(true)
        }
      })
      .catch(() => setDocs([]))
  }, [])

  // 核心过滤逻辑
  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const docDate = new Date(d.created_at || '')
      const inPeriod = docDate >= selectedPeriod.startDate && docDate <= selectedPeriod.endDate
      const matchesQuery = !query || (d.supplier_name ?? '').toLowerCase().includes(query.toLowerCase())
      return inPeriod && matchesQuery
    })
  }, [docs, query, selectedPeriod])

  // --- 统计数据逻辑更新：精准计算可抵扣税额 ---
  const stats = useMemo(() => {
    const count = filtered.length;
    
    // 仅汇总标记为 input_tax_claimable 的单据
    const estimatedInputSst = filtered
      .filter((d) => {
        const treatment = d.tax_treatment ?? d.agent_result?.tax_treatment ?? '';
        return treatment.includes('input_tax_claimable');
      })
      .reduce((sum, d) => {
        // 优先使用 AI 提取的 sst_amount，没有则按 6% 估算
        const sst = d.agent_result?.amount?.sst_amount;
        if (typeof sst === 'number') return sum + sst;
        
        const base = d.total_amount ?? d.agent_result?.amount?.total ?? 0;
        return sum + (base * 0.06);
      }, 0);

    return { count, sst: estimatedInputSst };
  }, [filtered])

  // --- 真实删除功能 ---
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() 
    if (!window.confirm("Confirm delete this record? This action will remove it from the database.")) {
      return
    }

    try {
      await deleteDocument(id)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error("Delete failed:", err)
      alert("Failed to delete document. Please try again later.")
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm(`Submit ${stats.count} documents for ${selectedPeriod.label}? This will lock the period.`)) return
    try {
      // Map period to year/month: use the last month of the period
      const monthMap: Record<string, number> = { '2026-Q1': 2, '2026-Q2': 4, '2026-Q3': 6 }
      const month = monthMap[selectedPeriod.id] ?? 4
      await submitPeriod(2026, month)
      setIsSubmitted(true)
      // Refresh docs to reflect new status
      const data = await getDocuments()
      setDocs(data.documents as TaxDocument[])
    } catch {
      setIsSubmitted(true) // still lock UI optimistically
    }
  }

  // 判断锁定逻辑
  const isLocked = isSubmitted || selectedPeriod.status === 'filed';

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6 pb-40 font-sans text-slate-700">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Document Repository</h1>
          <p className="text-sm text-slate-500 mt-1">
            Current Phase: <span className={`font-semibold uppercase tracking-wider ${selectedPeriod.status === 'filed' ? 'text-emerald-600' : 'text-blue-600'}`}>
              {selectedPeriod.status}
            </span>
          </p>
        </div>
        <select 
          disabled={isSubmitted}
          value={selectedPeriod.id} 
          onChange={(e) => {
            const p = PERIODS.find(p => p.id === e.target.value) || PERIODS[1];
            setSelectedPeriod(p);
            if (p.status === 'filed') setIsSubmitted(false);
          }}
          className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium outline-none shadow-sm focus:ring-1 focus:ring-blue-500 transition-all"
        >
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none shadow-sm focus:ring-1 focus:ring-blue-500"
          placeholder="Search by supplier name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4 text-right">Amount (RM)</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((doc) => (
              <tr key={doc.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">{new Date(doc.created_at || '').toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{doc.supplier_name || 'Processing...'}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-slate-900 tracking-tight">
                  {doc.total_amount?.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                    doc.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {statusLabels[doc.status] || doc.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-4">
                    {!isLocked && (
                      <button 
                        onClick={(e) => handleDelete(doc.id, e)} 
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <Link 
                      to={`/owner/documents/${doc.id}`} 
                      className="text-blue-600 text-sm font-semibold hover:underline flex items-center gap-1"
                    >
                      {isLocked && <Lock size={12} />}
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filtered.length === 0 && (
          <div className="py-24 text-center space-y-2">
            <AlertCircle className="mx-auto text-slate-200" size={40} strokeWidth={1.5} />
            <p className="text-sm text-slate-400 font-light italic">No documents found for this criteria.</p>
          </div>
        )}
      </div>

      {/* --- Floating Bottom Bar --- */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-5xl bg-slate-900 text-white rounded-2xl p-6 shadow-2xl flex flex-wrap items-center justify-between z-50 border border-white/10 backdrop-blur-md">
        <div className="flex gap-12 items-center px-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">Total Invoices</p>
            <p className="text-2xl font-semibold mt-1.5 leading-none">{stats.count}</p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">Est. Tax Credit</p>
            <p className="text-2xl font-semibold text-blue-400 mt-1.5 leading-none">RM {stats.sst.toFixed(2)}</p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLocked || filtered.length === 0 || selectedPeriod.status === 'upcoming'}
          className={`flex items-center gap-2.5 px-10 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
            selectedPeriod.status === 'filed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            selectedPeriod.status === 'upcoming' ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' :
            isSubmitted ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50' :
            'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)]'
          }`}
        >
          {selectedPeriod.status === 'filed' ? (
            <><FileArchive size={18} strokeWidth={2.5} /> Period Archived</>
          ) : selectedPeriod.status === 'upcoming' ? (
            <><Clock size={18} strokeWidth={2.5} /> Waiting for Start</>
          ) : isSubmitted ? (
            <><CheckCircle2 size={18} strokeWidth={2.5} /> Handed Over</>
          ) : (
            <><Send size={18} strokeWidth={2.5} /> Submit to Accountant</>
          )}
        </button>
      </div>
    </div>
  )
}
// Fonts used: Playfair Display (headings) + Inter (body/numbers)
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
  FileArchive,
  ChevronDown
} from 'lucide-react'

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

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

  useEffect(() => {
    getDocuments()
      .then((data) => {
        const loaded = data.documents as TaxDocument[]
        setDocs(loaded)
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

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const docDate = new Date(d.created_at || '')
      const inPeriod = docDate >= selectedPeriod.startDate && docDate <= selectedPeriod.endDate
      const matchesQuery = !query || (d.supplier_name ?? '').toLowerCase().includes(query.toLowerCase())
      return inPeriod && matchesQuery
    })
  }, [docs, query, selectedPeriod])

  const stats = useMemo(() => {
    const count = filtered.length;
    const estimatedInputSst = filtered
      .filter((d) => {
        const treatment = d.tax_treatment ?? d.agent_result?.tax_treatment ?? '';
        return treatment.includes('input_tax_claimable');
      })
      .reduce((sum, d) => {
        const sst = d.agent_result?.amount?.sst_amount;
        if (typeof sst === 'number') return sum + sst;
        const base = d.total_amount ?? d.agent_result?.amount?.total ?? 0;
        return sum + (base * 0.06);
      }, 0);
    return { count, sst: estimatedInputSst };
  }, [filtered])

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
      const monthMap: Record<string, number> = { '2026-Q1': 2, '2026-Q2': 4, '2026-Q3': 6 }
      const month = monthMap[selectedPeriod.id] ?? 4
      await submitPeriod(2026, month)
      setIsSubmitted(true)
      const data = await getDocuments()
      setDocs(data.documents as TaxDocument[])
    } catch {
      setIsSubmitted(true) 
    }
  }

  const isLocked = isSubmitted || selectedPeriod.status === 'filed';

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-8 pb-48" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
            Document Repository
          </h1>
          <p className="text-sm font-normal text-slate-500">
            Current Phase: <span className="font-semibold uppercase tracking-widest text-[10px] ml-2 px-2 py-0.5 rounded border" 
            style={{ 
              color: selectedPeriod.status === 'filed' ? '#22c55e' : COLOR_ACCENT,
              borderColor: selectedPeriod.status === 'filed' ? '#bbf7d0' : '#fef08a'
            }}>
              {selectedPeriod.status}
            </span>
          </p>
        </div>
        
        <div className="relative">
          <select 
            disabled={isSubmitted}
            value={selectedPeriod.id} 
            onChange={(e) => {
              const p = PERIODS.find(p => p.id === e.target.value) || PERIODS[1];
              setSelectedPeriod(p);
              if (p.status === 'filed') setIsSubmitted(false);
            }}
            className="appearance-none bg-white border border-blue-100 pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium outline-none shadow-sm transition-all"
            style={{ color: COLOR_PRIMARY }}
          >
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300" size={14} />
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl outline-none transition-all"
          style={{ boxShadow: '0 4px 12px rgba(10,61,124,0.06)' }}
          placeholder="Search by supplier name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white border border-blue-50 rounded-3xl overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5">Supplier</th>
              <th className="px-8 py-5 text-right">Amount (RM)</th>
              <th className="px-8 py-5 text-center">Status</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((doc) => (
              <tr key={doc.id} className="group hover:bg-blue-50/30 transition-colors">
                <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(doc.created_at || '').toLocaleDateString('en-GB')}</td>
                <td className="px-8 py-5 text-sm font-semibold text-slate-700">{doc.supplier_name || 'Processing...'}</td>
                <td className="px-8 py-5 text-right font-bold tracking-tight text-slate-900" style={{ fontSize: '1rem' }}>
                  {doc.total_amount?.toFixed(2)}
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                    doc.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    {statusLabels[doc.status] || doc.status}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-5">
                    {!isLocked && (
                      <button 
                        onClick={(e) => handleDelete(doc.id, e)} 
                        className="text-slate-300 hover:text-red-400 transition-all transform hover:scale-110"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    )}
                    <Link 
                      to={`/owner/documents/${doc.id}`} 
                      className="text-blue-500 text-[11px] font-bold uppercase tracking-widest hover:text-blue-700 flex items-center gap-1.5 transition-colors"
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
          <div className="py-32 text-center space-y-3">
            <AlertCircle className="mx-auto text-slate-200" size={48} strokeWidth={1} />
            <p className="text-xs text-slate-300 font-light tracking-[0.1em] uppercase italic">No documents found for this period</p>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-6xl bg-[#0A3D7C]/95 backdrop-blur-xl text-white rounded-[2rem] p-8 flex flex-wrap items-center justify-between z-50 border border-white/10" style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div className="flex gap-16 items-center px-6">
          <div>
            <p className="text-[10px] text-blue-300/60 uppercase font-bold tracking-[0.2em] leading-none">Total Invoices</p>
            <p className="text-3xl font-bold mt-2 leading-none tabular-nums">{stats.count}</p>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <p className="text-[10px] text-blue-300/60 uppercase font-bold tracking-[0.2em] leading-none">Est. Tax Credit</p>
            <p className="text-3xl font-bold text-blue-400 mt-2 leading-none tabular-nums">
              <span className="text-sm mr-1 opacity-50 font-medium">RM</span>
              {stats.sst.toFixed(2)}
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLocked || filtered.length === 0 || selectedPeriod.status === 'upcoming'}
          className={`flex items-center gap-3 px-12 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
            selectedPeriod.status === 'filed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            selectedPeriod.status === 'upcoming' ? 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed' :
            isSubmitted ? 'bg-blue-400/10 text-blue-300 border border-blue-400/20' :
            'bg-[#F5A623] hover:bg-[#ffb433] text-white shadow-2xl shadow-orange-900/40'
          }`}
        >
          {selectedPeriod.status === 'filed' ? (
            <><FileArchive size={16} /> Period Archived</>
          ) : selectedPeriod.status === 'upcoming' ? (
            <><Clock size={16} /> Waiting for Phase</>
          ) : isSubmitted ? (
            <><CheckCircle2 size={16} /> Handed Over</>
          ) : (
            <><Send size={16} /> Submit to Accountant</>
          )}
        </button>
      </div>
    </div>
  )
}
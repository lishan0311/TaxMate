import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDocuments } from '../../api/client'
import { 
  ArrowLeft, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Clock,
  FileText
} from 'lucide-react'

// --- Font and Color Constants ---
const COLOR_PRIMARY = "#0A3D7C"

export default function AccountantQueue() {
  const [docs, setDocs] = useState<any[]>([]) 
  const [mode, setMode] = useState<'priority' | 'time'>('priority')
  const [searchParams] = useSearchParams()
  const clientFilter = searchParams.get('client')

  useEffect(() => {
    getDocuments()
      .then((data) => setDocs(data.documents as any[]))
      .catch(() => setDocs([]))
  }, [])

  // 1. Core filtering and sorting logic - Reserved  const queue = useMemo(() => {
    let base = docs;
    if (clientFilter) {
      base = base.filter(d => 
        (d.agent_result?.business_name === clientFilter) || 
        (d.supplier_name === clientFilter)
      )
    }
    if (mode === 'priority') {
      return [...base].sort((a, b) => (b.risk_count ?? 0) - (a.risk_count ?? 0))
    }
    return [...base].sort((a, b) => +new Date(b.created_at || '') - +new Date(a.created_at || ''))
  }, [docs, mode, clientFilter])

  const isAllReviewed = useMemo(() => {
    if (queue.length === 0) return false;
    return queue.every(d => d.status === 'approved' || d.status === 'rejected');
  }, [queue])

  const handleGeneratePDF = () => {
    alert(`Generating SST-02 PDF for ${clientFilter}...`);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-8 animate-in fade-in duration-500 pb-20">
      
      {/* Top navigation and operation area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/accountant/clients" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Review Queue</h1>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">
              Client: {clientFilter || 'All Portfolio'}
            </p>
          </div>
        </div>

        {/* --- Right-top PDF button - Deepen projection --- */}
        <button
          onClick={handleGeneratePDF}
          disabled={!isAllReviewed}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
            isAllReviewed 
              ? 'bg-red-600 text-white shadow-xl shadow-red-900/30 hover:bg-red-700' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <FileText size={16} />
          Generate SST PDF
        </button>
      </div>

      {/* Sorting and filtering toolbar */}
      <div className="flex items-center gap-3 justify-end">
        <Filter size={16} className="text-slate-400" />
        <select 
          className="bg-white border border-slate-200 text-[11px] font-black uppercase px-4 py-2 rounded-xl outline-none transition-all focus:ring-2 focus:ring-blue-100 shadow-sm" 
          value={mode} 
          onChange={(e) => setMode(e.target.value as 'priority' | 'time')}
        >
          <option value="priority">High Risk First</option>
          <option value="time">Latest Uploads</option>
        </select>
      </div>

      {/* List content - Enhance shadow */}
      <div className="space-y-6">
        {queue.map((doc) => {
          const isDone = doc.status === 'approved' || doc.status === 'rejected';
          
          return (
            <div 
              key={doc.id} 
              className={`group bg-white border border-slate-100 rounded-[2rem] p-7 transition-all hover:-translate-y-1 ${
                isDone ? 'opacity-75 grayscale-[0.5]' :
                doc.risk_count ? 'border-rose-100 bg-rose-50/10' : 'border-blue-50'
              }`}
              style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-6">
                  <div className={`p-4 rounded-[1.5rem] shadow-inner ${
                    isDone ? 'bg-slate-100 text-slate-400' :
                    doc.risk_count ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-500'
                  }`}>
                    {isDone ? <CheckCircle2 size={24} className="text-emerald-500" /> :
                     doc.risk_count ? <AlertTriangle size={24} /> : <Clock size={24} />}
                  </div>
                  
                  <div className="space-y-1 flex flex-col justify-center">
                    <p className={`text-xl font-black tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {doc.supplier_name || 'Receipt #'+doc.id.slice(0,4)}
                    </p>
                    <div className="flex items-center gap-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Clock size={12}/> {new Date(doc.created_at || '').toLocaleDateString()}</span>
                      <span className="text-slate-500">RM {doc.total_amount?.toFixed(2) ?? '0.00'}</span>
                      <span className={`px-2 py-0.5 rounded font-black ${isDone ? 'bg-slate-100' : 'bg-blue-50 text-blue-600'}`}>
                        {doc.status.replace('_', ' ')}
                      </span>
                      {doc.review_action === 'ai_approved' && (
                        <span className="px-2 py-0.5 rounded font-black bg-green-50 text-green-600">AI Auto-Approved</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  {!isDone && doc.risk_count > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest animate-pulse shadow-lg shadow-rose-900/20">
                      {doc.risk_count} Anomalies Detected
                    </span>
                  )}
                  
                  <Link 
                    to={`/accountant/workbench/${doc.id}`} 
                    className={`px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${
                        isDone 
                          ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                          : 'bg-slate-900 text-white hover:bg-blue-700 shadow-blue-900/20'
                    }`}
                  >
                    {isDone ? 'Re-verify' : 'Open Workbench'} <ChevronRight size={14} className="inline ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {queue.length === 0 && (
          <div className="text-center py-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
            <p className="text-slate-500 font-bold tracking-widest uppercase text-xs italic">Waiting for client submission...</p>
          </div>
        )}
      </div>
    </div>
  )
}
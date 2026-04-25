// AccountantClients.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClientsList } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Users, Clock, ChevronRight, Calendar, Building2, AlertCircle } from 'lucide-react'

// --- Font and Color Constants ---
const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

interface ClientRow {
  client_id: string
  client_email: string
  company_name: string
  pending_count: number
  total_count: number
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AccountantClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const displayName = useMemo(() => {
    if (!user) return 'Partner'
    return user.name || user.email.split('@')[0]
  }, [user])

  useEffect(() => {
    getClientsList()
      .then((data) => setClients(data.clients))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))

    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const totalPending = useMemo(() => clients.reduce((s, c) => s + c.pending_count, 0), [clients])

  return (
    <div className="max-w-6xl mx-auto space-y-10 p-8" style={{ fontFamily: FONT_BODY, color: '#334155' }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-blue-50 pb-8">
        <div>
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
            Welcome, <span className="italic" style={{ fontWeight: 600 }}>{displayName}</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
            <Users size={12} className="text-blue-400" /> Accountant Portfolio Overview
            {totalPending > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full tracking-normal">
                {totalPending} action required
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">System Environment Time</p>
          <p className="text-sm font-bold text-[#0A3D7C] tabular-nums bg-blue-50/50 px-4 py-1.5 rounded-xl border border-blue-100" style={{ fontFamily: FONT_BODY, boxShadow: '0 4px 12px rgba(10,61,124,0.08)' }}>
            {formatDateTime(now)}
          </p>
        </div>
      </div>

      {/* Client grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-white border border-blue-50 rounded-3xl p-8 h-32 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-32 text-center bg-slate-50/30 rounded-[2.5rem] border border-dashed border-slate-200">
          <Building2 size={40} className="mx-auto text-slate-200 mb-4" strokeWidth={1} />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No active clients in portfolio</p>
          <p className="text-xs text-slate-300 italic mt-2 tracking-tight">Client records appear once document processing begins.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {clients.map((row) => (
            <div
              key={row.client_id}
              className="bg-white border border-blue-50 rounded-[2rem] p-8 flex justify-between items-center transition-all hover:border-blue-200 hover:-translate-y-1"
              style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                    row.pending_count > 0 ? 'bg-orange-50 text-[#F5A623]' : 'bg-slate-50 text-slate-300'
                  }`}
                >
                  {row.pending_count > 0 ? <AlertCircle size={28} /> : <Building2 size={28} />}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                    {row.company_name}
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-1">{row.client_email}</p>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{row.total_count} Documents</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-md ${
                    row.pending_count > 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {row.pending_count} Pending
                </span>
                <Link
                  to={`/accountant/workbench/_?client=${encodeURIComponent(row.client_id)}`}
                  className="text-blue-500 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 hover:text-[#0A3D7C] transition-colors"
                >
                  Review Queue <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
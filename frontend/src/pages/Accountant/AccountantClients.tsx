import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClientsList } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Users, Clock, ChevronRight, Calendar, Building2, AlertCircle } from 'lucide-react'

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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">

      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Welcome, <span className="text-indigo-600 capitalize">{displayName}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Users size={14} /> Accountant Portfolio Overview
            {totalPending > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {totalPending} pending
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Time</p>
          <p className="text-sm font-bold text-slate-700 font-mono bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
            {formatDateTime(now)}
          </p>
        </div>
      </div>

      {/* Client grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white border border-slate-100 rounded-4xl p-6 h-28 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 font-medium">No clients registered yet.</p>
          <p className="text-slate-300 text-sm mt-1">Clients will appear here once they register and upload documents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map((row) => (
            <div
              key={row.client_id}
              className="group bg-white border border-slate-100 rounded-4xl p-6 flex justify-between items-center shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300"
            >
              <div className="flex items-center gap-5">
                <div
                  className={`p-4 rounded-2xl ${
                    row.pending_count > 0 ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-300'
                  }`}
                >
                  {row.pending_count > 0 ? <AlertCircle size={24} /> : <Calendar size={24} />}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-800 tracking-tight">
                    {row.company_name}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">{row.client_email}</p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {row.total_count} total receipt{row.total_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                      row.pending_count > 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {row.pending_count} Pending
                  </span>
                  <div className="mt-2">
                    <Link
                      to={`/accountant/workbench/_?client=${encodeURIComponent(row.client_id)}`}
                      className="text-indigo-600 text-[11px] font-bold flex items-center gap-1 hover:underline group-hover:gap-2 transition-all"
                    >
                      <Clock size={12} />
                      Review Queue <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

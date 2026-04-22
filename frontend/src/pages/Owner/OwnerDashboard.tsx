import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDocuments } from '../../api/client'
import { getOwnerAuth } from '../../lib/storage'
import type { TaxDocument } from '../../types'
import { 
  Calendar, 
  ChevronDown, 
  Lock, 
  Upload, 
  Clock, 
  TrendingUp, 
  FileText,
  ShieldCheck
} from 'lucide-react'

// --- 1. 配置与辅助函数 ---
type PeriodStatus = 'filed' | 'current' | 'upcoming';
interface Period {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  deadline: Date;
  status: PeriodStatus;
}

const PERIODS: Period[] = [
  { 
    id: '2026-Q3', label: 'May 2026 - Jun 2026', 
    startDate: new Date(2026, 4, 1), endDate: new Date(2026, 5, 30), 
    deadline: new Date(2026, 6, 31), status: 'upcoming' 
  },
  { 
    id: '2026-Q2', label: 'Mar 2026 - Apr 2026', 
    startDate: new Date(2026, 2, 1), endDate: new Date(2026, 3, 30), 
    deadline: new Date(2026, 4, 31), status: 'current' 
  },
  { 
    id: '2026-Q1', label: 'Jan 2026 - Feb 2026', 
    startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 28), 
    deadline: new Date(2026, 2, 31), status: 'filed' 
  },
];

function toAmount(value?: number | null): number { return value ?? 0; }
function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function OwnerDashboard() {
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [now, setNow] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[1]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const navigate = useNavigate();
  const owner = getOwnerAuth();
  const username = owner?.email ? owner.email.split('@')[0] : 'Owner';

  useEffect(() => {
    getDocuments().then((data) => setDocs(data.documents as TaxDocument[])).catch(() => setDocs([]));
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 数据隔离过滤器
  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      const docDate = new Date(d.created_at || '');
      return docDate >= selectedPeriod.startDate && docDate <= selectedPeriod.endDate;
    });
  }, [docs, selectedPeriod]);

  const isSubmitted = useMemo(() => {
    return filteredDocs.some((d) => ['pending_review', 'approved', 'signed'].includes(d.status));
  }, [filteredDocs]);

  // 核心判断：该账期是否被锁定（已归档或已提交审计/签署）
  const isLocked = useMemo(() => {
    return selectedPeriod.status === 'filed' || isSubmitted;
  }, [selectedPeriod, isSubmitted]);

  // 统计逻辑
  const summary = useMemo(() => {
    const inputTax = filteredDocs
      .filter((d) => d.tax_treatment?.includes('input_tax'))
      .reduce((sum, d) => sum + toAmount(d.total_amount), 0);
    const outputTax = filteredDocs
      .filter((d) => d.tax_treatment === 'output_tax')
      .reduce((sum, d) => sum + toAmount(d.total_amount), 0);
    return { inputTax, outputTax, count: filteredDocs.length };
  }, [filteredDocs]);

  // 倒计时逻辑
  const countdown = useMemo(() => {
    if (selectedPeriod.status !== 'current' || isLocked) return null;
    const diffMs = Math.max(0, selectedPeriod.deadline.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }, [selectedPeriod, now, isLocked]);

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-8 pb-20 font-sans text-slate-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-light text-slate-900 tracking-tight">
            Good day, <span className="font-medium capitalize">{username}</span>
          </h1>
          <p className="text-slate-400 font-normal tracking-wide text-sm">
            Overview for <span className="text-indigo-500">{selectedPeriod.label}</span>
          </p>
        </div>

        {/* Period Picker */}
        <div className="relative">
          <button 
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className="w-full md:w-64 flex items-center justify-between bg-white border border-slate-200 px-5 py-3 rounded-xl shadow-sm hover:border-indigo-300 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Calendar className="text-indigo-400" size={18} />
              <span className="text-sm font-medium text-slate-600 tracking-wide">{selectedPeriod.label}</span>
            </div>
            <ChevronDown size={14} className={`text-slate-300 transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPickerOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPeriod(p); setIsPickerOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${
                    selectedPeriod.id === p.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-widest opacity-40 ${selectedPeriod.id === p.id ? 'text-indigo-400' : ''}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.status === 'filed' ? <ShieldCheck size={16} /> : p.status === 'upcoming' ? <TrendingUp size={16} /> : <Clock size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="Input Tax (Claimable)" value={`RM ${summary.inputTax.toFixed(2)}`} color="indigo" />
        <StatCard title="Output Tax (Payable)" value={`RM ${summary.outputTax.toFixed(2)}`} color="indigo" />
        <StatCard title="Total Records" value={String(summary.count)} color="slate" />
      </div>

      {/* Action Banner */}
      <div className={`rounded-[2rem] p-10 transition-all duration-700 relative overflow-hidden ${
        isLocked ? 'bg-white border border-slate-100' :
        selectedPeriod.status === 'upcoming' ? 'bg-indigo-600 text-white' :
        'bg-slate-900 text-white'
      }`}>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="space-y-6 text-center lg:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.15em] ${
              isLocked ? 'bg-indigo-50 text-indigo-600' : 'bg-white/10 text-white/80'
            }`}>
              {isSubmitted ? 'Audit in Progress' : `${selectedPeriod.status} Phase`}
            </div>

            {selectedPeriod.status === 'current' && !isLocked && countdown ? (
              <div className="flex items-end justify-center lg:justify-start gap-6">
                <TimeBox value={countdown.days} unit="Days" />
                <TimeBox value={countdown.hours} unit="Hrs" />
                <TimeBox value={countdown.minutes} unit="Min" />
                <TimeBox value={countdown.seconds} unit="Sec" />
              </div>
            ) : isSubmitted ? (
              <div className="space-y-1">
                <p className="text-4xl font-extralight tracking-tight text-slate-800 tracking-tighter italic">Handed Over <span className="font-normal text-indigo-500 font-sans not-italic tracking-normal">to Auditor</span></p>
                <p className="text-slate-400 text-sm font-light tracking-wide">Verification typically takes 1-3 working days.</p>
              </div>
            ) : selectedPeriod.status === 'upcoming' ? (
              <div className="space-y-1">
                <p className="text-4xl font-extralight tracking-tight">System is <span className="font-normal text-indigo-200">Preparing</span></p>
                <p className="text-white/50 text-sm font-light tracking-wide">The tax period opens in {Math.ceil((selectedPeriod.startDate.getTime() - now.getTime()) / 86400000)} days.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-4xl font-extralight tracking-tight text-slate-800">Archive <span className="font-normal text-emerald-500">Secured</span></p>
                <p className="text-slate-400 text-sm font-light tracking-wide">Filing locked. Reference: MY-SST-2026-00812</p>
              </div>
            )}
            
            <p className="text-[10px] font-light tracking-[0.2em] uppercase opacity-40 italic">
              Official Deadline: {formatDate(selectedPeriod.deadline)}
            </p>
          </div>

          <div className="w-full lg:w-auto">
            {selectedPeriod.status === 'filed' ? (
              <button 
                onClick={() => window.open('http://localhost:8000/api/documents/export-sst02?month=2', '_blank')}
                className="w-full lg:w-72 bg-slate-800 text-white font-medium py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg active:scale-[0.98]"
              >
                <FileText size={18} strokeWidth={1.5} />
                Download PDF
              </button>
            ) : (
              <button 
                disabled={isLocked}
                onClick={() => navigate('/owner/upload', { state: { periodId: selectedPeriod.id, periodLabel: selectedPeriod.label } })}
                className={`w-full lg:w-72 font-medium py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] ${
                  isLocked 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                    : 'bg-white text-slate-900 hover:shadow-indigo-500/20'
                }`}
              >
                {isLocked ? <Lock size={18} strokeWidth={1.5} className="text-slate-300" /> : <Upload size={18} strokeWidth={1.5} className="text-indigo-500" />}
                {isSubmitted ? 'Locked for Audit' : selectedPeriod.status === 'current' ? 'Upload Receipt' : 'Pre-upload Data'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions (Limited to 5) */}
      <div className="bg-white rounded-3xl border border-slate-50 p-10 shadow-sm shadow-slate-200/50">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-medium text-slate-800 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Recent Transactions
          </h2>
          <Link to="/owner/documents" className="text-[10px] font-medium uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors">
            View All Records
          </Link>
        </div>

        <div className="space-y-1">
          {filteredDocs.slice(0, 5).map((doc) => (
            <div key={doc.id} className="group flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-6">
                <div className="text-slate-300 group-hover:text-indigo-400 transition-colors">
                  <FileText size={20} strokeWidth={1.2} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 tracking-tight">{doc.supplier_name || 'Processing AI...'}</p>
                  <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">
                    {doc.tax_treatment?.replace('_', ' ')} • {formatDate(new Date(doc.created_at || ''))}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-medium text-slate-900 tracking-tight">RM {toAmount(doc.total_amount).toFixed(2)}</p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{doc.status}</span>
                  <div className={`w-1 h-1 rounded-full ${doc.status === 'approved' ? 'bg-emerald-400' : 'bg-orange-400 animate-pulse'}`} />
                </div>
              </div>
            </div>
          ))}
          
          {filteredDocs.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-xs text-slate-300 font-light tracking-[0.2em] uppercase italic">No records in this environment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- 子组件 ---

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100/50 p-8 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] mb-3">{title}</p>
      <p className={`text-2xl font-light tracking-tight ${color === 'indigo' ? 'text-indigo-600' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  )
}

function TimeBox({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <p className="text-3xl font-extralight tabular-nums leading-none tracking-tighter">{String(value).padStart(2, '0')}</p>
      <p className="text-[9px] uppercase font-light tracking-[0.1em] opacity-40 mt-3">{unit}</p>
    </div>
  )
}
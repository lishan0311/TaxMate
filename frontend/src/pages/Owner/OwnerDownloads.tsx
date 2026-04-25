// Fonts used: Playfair Display (headings) + Inter (body/numbers)
import { useState } from 'react'
import { exportSst02 } from '../../api/client'
import { 
  FileText,
  Download,
  ShieldCheck,
  Loader2,
  CalendarDays,
  FileCheck2,
  ChevronDown
} from 'lucide-react'

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

const PERIODS = [
  { id: '2026-Q2', label: 'Mar 2026 - Apr 2026', year: 2026, month: 4 },
  { id: '2026-Q1', label: 'Jan 2026 - Feb 2026', year: 2026, month: 2 },
]

export default function DownloadCenter() {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0])
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (isDraft: boolean) => {
    const type = isDraft ? 'draft' : 'signed'
    setDownloading(type)
    try {
      const blob = await exportSst02(selectedPeriod.year, selectedPeriod.month, isDraft)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = isDraft ? 'DRAFT_PREVIEW' : 'OFFICIAL_SIGNED'
      a.download = `SST-02_${selectedPeriod.id}_${suffix}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      let msg = "Download failed. Ensure documents are ready."
      if (err.response?.data instanceof Blob) {
        try { const t = await err.response.data.text(); msg = JSON.parse(t).detail || msg } catch {}
      } else {
        msg = err.response?.data?.detail || err.message || msg
      }
      alert(msg)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-blue-50 pb-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
            Download Repository
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
            Official Compliance Export & Archive
          </p>
        </div>

        {/* The Period selector has a consistent style.*/}
        <div className="flex flex-col gap-2">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Select Tax Period</label>
          <div className="relative">
            <div className="flex items-center gap-3 bg-white border border-blue-100 pl-4 pr-10 py-2.5 rounded-xl shadow-sm" style={{ boxShadow: '0 4px 12px rgba(10,61,124,0.05)' }}>
              <CalendarDays size={16} className="text-blue-400" />
              <select
                value={selectedPeriod.id}
                onChange={(e) => setSelectedPeriod(PERIODS.find(p => p.id === e.target.value)!)}
                className="appearance-none bg-transparent border-none outline-none text-sm font-semibold cursor-pointer text-[#0A3D7C]"
              >
                {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300" size={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* First column: Draft Preview - Darken the shadows */}
        <div className="bg-white rounded-[2rem] border border-blue-50 overflow-hidden transition-all hover:translate-y-[-2px]" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <div className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <div className="bg-blue-50 p-6 rounded-2xl text-blue-500 shadow-inner">
                <FileText size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">SST-02 Filing Draft</h3>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-full uppercase tracking-widest">Unsigned</span>
                </div>
                <p className="text-sm text-slate-400 max-w-md leading-relaxed font-medium italic">
                  Internal verification draft. Generates a preview of your tax liabilities based on all processed documents for {selectedPeriod.label}.
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleDownload(true)}
              disabled={!!downloading}
              className="min-w-60 bg-[#0A3D7C] text-white px-8 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#0d4d9e] transition-all active:scale-95 disabled:opacity-50 shadow-xl"
              style={{ boxShadow: '0 10px 25px rgba(10,61,124,0.25)' }}
            >
              {downloading === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download Draft
            </button>
          </div>
        </div>

        {/* Second column: Official Signed - Darken the shadows */}
        <div className="bg-white rounded-[2rem] border border-blue-50 overflow-hidden transition-all hover:translate-y-[-2px]" style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}>
          <div className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <div className="bg-emerald-50 p-6 rounded-2xl text-emerald-500 shadow-inner">
                <FileCheck2 size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">Official Signed SST-02</h3>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded-full uppercase tracking-widest">Signed</span>
                </div>
                <p className="text-sm text-slate-400 max-w-md leading-relaxed font-medium italic">
                  Finalized report featuring the accountant's digital signature and company stamp. Legally compliant and ready for JKDM portal upload.
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleDownload(false)}
              disabled={!!downloading}
              className="min-w-60 bg-[#F5A623] text-white px-8 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#ffb433] transition-all active:scale-95 disabled:opacity-50 shadow-xl"
              style={{ boxShadow: '0 10px 25px rgba(245,166,35,0.25)' }}
            >
              {downloading === 'signed' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Download Signed
            </button>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="pt-10 flex items-center justify-center gap-3 text-slate-300">
        <ShieldCheck size={14} />
        <p className="text-[9px] font-bold uppercase tracking-[0.2em]">
          All exports are secured with AES-256 encryption & JKDM Compliant
        </p>
      </div>

    </div>
  )
}
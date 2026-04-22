import { useState } from 'react'
import { exportSst02 } from '../../api/client'
import { 
  FileText,
  Download,
  ShieldCheck,
  Loader2,
  CalendarDays,
  FileCheck2
} from 'lucide-react'

// 复用你的 Period 定义
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
    <div className="max-w-6xl mx-auto p-8 space-y-12 animate-in fade-in duration-700">
      
      {/* Header - 更加干净利落 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Download Center</h1>
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-[0.2em] font-black">
            Official Compliance Export & Archive
          </p>
        </div>

        {/* 统一的 Period 选择器 */}
        <div className="flex flex-col gap-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Tax Period</label>
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
            <CalendarDays size={18} className="ml-3 text-indigo-500" />
            <select
              value={selectedPeriod.id}
              onChange={(e) => setSelectedPeriod(PERIODS.find(p => p.id === e.target.value)!)}
              className="bg-transparent border-none outline-none text-sm font-bold pr-10 py-2 cursor-pointer text-slate-700"
            >
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* 第一栏：Draft Preview */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
          <div className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <div className="bg-indigo-50 p-6 rounded-4xl text-indigo-600 group-hover:rotate-6 transition-transform duration-500">
                <FileText size={36} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">SST-02 Filing Draft</h3>
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-full uppercase tracking-widest">Unsigned</span>
                </div>
                <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                  Internal verification draft. Generates a preview of your tax liabilities based on all processed documents for {selectedPeriod.label}.
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleDownload(true)}
              disabled={!!downloading}
              className="min-w-60 bg-indigo-600 text-white px-8 py-5 rounded-3xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-indigo-100"
            >
              {downloading === 'draft' ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              Download Draft
            </button>
          </div>
        </div>

        {/* 第二栏：Official Signed */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
          <div className="p-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <div className="bg-emerald-50 p-6 rounded-4xl text-emerald-600 group-hover:rotate-6 transition-transform duration-500">
                <FileCheck2 size={36} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Official Signed SST-02</h3>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase tracking-widest">Signed</span>
                </div>
                <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                  Finalized report featuring the accountant's digital signature and company stamp. Legally compliant and ready for JKDM portal upload.
                </p>
              </div>
            </div>

            <button 
              onClick={() => handleDownload(false)}
              disabled={!!downloading}
              className="min-w-60 bg-slate-900 text-white px-8 py-5 rounded-3xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-xl disabled:opacity-50"
            >
              {downloading === 'signed' ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
              Download Signed
            </button>
          </div>
        </div>

      </div>

      {/* 补充：底部的合规小提示，替代那个笨重的黑色栏 */}
      <div className="pt-10 flex items-center justify-center gap-4 text-slate-400">
        <ShieldCheck size={16} />
        <p className="text-[10px] font-bold uppercase tracking-widest">
          All exports are secured with AES-256 encryption & JKDM Compliant
        </p>
      </div>

    </div>
  )
}
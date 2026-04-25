// OwnerUpload.tsx
import { useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFilesInBatch } from '../../api/client'
import TaxPlanningAdvice from '../../components/TaxPlanningAdvice'
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, X, Sparkles, ChevronRight } from 'lucide-react'

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

interface UploadState {
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'failed'
  documentId?: string
}

export default function OwnerUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [states, setStates] = useState<Record<string, UploadState>>({})
  const [dragOver, setDragOver] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      })),
    [files],
  )

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const existingNames = new Set(files.map((f) => f.name))
    const incoming = Array.from(fileList).filter((f) => {
      const isValidType = /pdf|jpg|jpeg|png/i.test(f.type) || /\.(pdf|jpg|jpeg|png)$/i.test(f.name)
      return isValidType && !existingNames.has(f.name)
    })
    if (incoming.length === 0) return
    setFiles((prev) => [...prev, ...incoming])
    setStates((prev) => {
      const next = { ...prev }
      for (const file of incoming) next[file.name] = { progress: 0, status: 'pending' }
      return next
    })
    setUploadDone(false)
  }

  function removeFile(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFiles((prev) => prev.filter((f) => f.name !== filename))
    setStates((prev) => {
      const next = { ...prev }
      delete next[filename]
      return next
    })
    const preview = previews.find((p) => p.name === filename)
    if (preview?.url) URL.revokeObjectURL(preview.url)
  }

  async function startUpload(targetFiles = files) {
    const filesToUpload = targetFiles.filter(
      (f) => states[f.name]?.status === 'pending' || states[f.name]?.status === 'failed',
    )
    if (filesToUpload.length === 0) return

    await uploadFilesInBatch(filesToUpload, (filename, progress) => {
      setStates((prev) => ({
        ...prev,
        [filename]: { ...(prev[filename] ?? { status: 'pending' }), progress, status: 'uploading' },
      }))
    }).then((results) => {
      setStates((prev) => {
        const next = { ...prev }
        for (const item of results) {
          const ok = item.result.success
          next[item.file] = {
            progress: 100,
            status: ok ? 'success' : 'failed',
            documentId: item.result.document_id,
          }
        }
        return next
      })
      const allSuccess = results.every((r) => r.result.success)
      if (allSuccess) setUploadDone(true)
    })
  }

  const failedFiles = files.filter((f) => states[f.name]?.status === 'failed')
  const successFiles = files.filter((f) => states[f.name]?.status === 'success')
  const isAnyUploading = Object.values(states).some((s) => s.status === 'uploading')

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-8" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
          Upload <span>Receipts</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">AI-Powered Extraction & Classification</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        className={`relative border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all duration-300 ${
          dragOver
            ? 'border-[#F5A623] bg-orange-50/30 scale-[1.01] shadow-2xl'
            : 'border-blue-100 bg-white hover:border-blue-300 shadow-2xl shadow-blue-900/10'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="bg-blue-50 p-6 rounded-[2rem] mb-6 text-[#0A3D7C]">
            <Upload size={40} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Drag and drop receipts here</h3>
          <p className="text-sm text-slate-400 mb-8 font-medium italic">Supports PDF, JPG, and PNG formats</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 bg-[#0A3D7C] text-white px-8 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-lg active:scale-95"
          >
            <FileUp size={16} className="text-[#F5A623]" /> Choose Files
          </button>
          <input
            ref={fileInputRef}
            type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {files.map((file) => {
            const s = states[file.name]
            const isSuccess = s?.status === 'success'
            const isFailed = s?.status === 'failed'
            return (
              <div
                key={file.name}
                className="bg-white border border-blue-50 rounded-[2rem] p-7 shadow-2xl shadow-blue-900/10 relative transition-all"
                style={isSuccess ? { borderLeft: '6px solid #22c55e' } : isFailed ? { borderLeft: '6px solid #ef4444' } : {}}
              >
                <button
                  type="button"
                  onClick={(e) => removeFile(file.name, e)}
                  className="absolute -top-3 -right-3 z-20 bg-white text-slate-300 hover:text-red-500 rounded-full p-2.5 shadow-xl border border-blue-50"
                >
                  <X size={18} />
                </button>
                <div className="flex gap-6">
                  <div className="relative shrink-0">
                    {previews.find((p) => p.name === file.name)?.url ? (
                      <img
                        src={previews.find((p) => p.name === file.name)?.url}
                        alt={file.name}
                        className="w-24 h-24 object-cover rounded-2xl border border-blue-50"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-200">
                        <FileUp size={36} />
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2">
                      {isSuccess && <CheckCircle className="text-green-500 bg-white rounded-full p-0.5 shadow-lg" size={24} />}
                      {isFailed && <AlertCircle className="text-red-500 bg-white rounded-full p-0.5 shadow-lg" size={24} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="font-bold text-[#0A3D7C] truncate text-base mb-1">{file.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{(file.size / 1024).toFixed(1)} KB</p>
                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden mb-3 shadow-inner">
                      <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${s?.progress ?? 0}%`, background: isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#0A3D7C' }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#94a3b8' }}>{s?.status || 'pending'}</span>
                      {s?.documentId && (
                        <button className="text-blue-500 text-[10px] font-bold uppercase tracking-widest hover:text-[#0A3D7C] flex items-center gap-1.5 transition-colors" onClick={() => navigate(`/owner/documents/${s.documentId}`)}>
                          View Details <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-6 pt-6">
        <button
          onClick={() => void startUpload()}
          disabled={files.length === 0 || isAnyUploading}
          className="flex-1 text-white font-bold py-5 rounded-3xl shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 text-[11px] uppercase tracking-[0.25em]"
          style={{ background: COLOR_PRIMARY, boxShadow: '0 15px 35px -10px rgba(10,61,124,0.4)' }}
        >
          {isAnyUploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
          Start Batch Processing
        </button>
        <button
          disabled={failedFiles.length === 0 || isAnyUploading}
          onClick={() => void startUpload(failedFiles)}
          className="bg-slate-800 text-white font-bold px-10 py-5 rounded-3xl disabled:opacity-30 flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] shadow-xl"
        >
          Retry Failed ({failedFiles.length})
        </button>
      </div>

      {/* Advice */}
      {uploadDone && successFiles.length > 0 && (
        <div className="space-y-6 pt-10">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500 bg-blue-50/50 w-fit px-5 py-2.5 rounded-full border border-blue-100">
            <Sparkles size={18} className="text-[#F5A623]" />
            {successFiles.length} item{successFiles.length > 1 ? 's' : ''} processed successfully
          </div>
          <div className="bg-white rounded-[2.5rem] p-2 shadow-2xl shadow-blue-900/15 border border-blue-50">
            <TaxPlanningAdvice />
          </div>
        </div>
      )}
    </div>
  )
}
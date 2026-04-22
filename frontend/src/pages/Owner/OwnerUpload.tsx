import { useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFilesInBatch } from '../../api/client'
import TaxPlanningAdvice from '../../components/TaxPlanningAdvice'
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, X, Sparkles } from 'lucide-react'

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
    <div className="max-w-5xl mx-auto space-y-8 p-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Upload Receipts</h1>
        <p className="text-gray-500 mt-1">AI-powered SST extraction and tax classification</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
          dragOver
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01] shadow-xl'
            : 'border-gray-200 bg-white hover:border-blue-400'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="bg-blue-100 p-4 rounded-2xl mb-4 text-blue-600">
            <Upload size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Drag and drop receipts here</h3>
          <p className="text-sm text-gray-500 mb-6">Supports PDF, JPG, and PNG formats</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <FileUp size={18} className="text-blue-500" /> Choose Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {files.map((file) => {
            const s = states[file.name]
            const isSuccess = s?.status === 'success'
            const isFailed = s?.status === 'failed'
            return (
              <div
                key={file.name}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all relative ${
                  isSuccess ? 'border-green-100 bg-green-50/10' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => removeFile(file.name, e)}
                  className="absolute -top-2 -right-2 z-20 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1 shadow-md border border-gray-100 transition-all active:scale-90"
                >
                  <X size={16} />
                </button>

                <div className="flex gap-4">
                  <div className="relative">
                    {previews.find((p) => p.name === file.name)?.url ? (
                      <img
                        src={previews.find((p) => p.name === file.name)?.url}
                        alt={file.name}
                        className="w-16 h-16 object-cover rounded-xl border border-gray-100"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        <FileUp size={24} />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1">
                      {isSuccess && <CheckCircle className="text-green-500 bg-white rounded-full" size={18} />}
                      {isFailed && <AlertCircle className="text-red-500 bg-white rounded-full" size={18} />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate text-sm">{file.name}</p>
                    <p className="text-xs text-gray-400 mb-2">{(file.size / 1024).toFixed(1)} KB</p>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isSuccess ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${s?.progress ?? 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${
                          isSuccess ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {s?.status || 'pending'}
                      </span>
                      {s?.documentId && (
                        <button
                          className="text-blue-600 text-xs font-bold hover:underline"
                          onClick={() => navigate(`/owner/documents/${s.documentId}`)}
                        >
                          View Details →
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
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => void startUpload()}
          disabled={files.length === 0 || isAnyUploading}
          className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {isAnyUploading ? <Loader2 className="animate-spin" /> : <Upload size={18} />}
          Start Batch Upload
        </button>
        <button
          disabled={failedFiles.length === 0 || isAnyUploading}
          onClick={() => void startUpload(failedFiles)}
          className="bg-gray-900 text-white font-bold px-6 py-3 rounded-2xl disabled:opacity-30 transition-all flex items-center gap-2"
        >
          Retry Failed ({failedFiles.length})
        </button>
      </div>

      {/* Tax planning advice — shown after successful upload */}
      {uploadDone && successFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Sparkles size={16} className="text-indigo-500" />
            {successFiles.length} receipt{successFiles.length > 1 ? 's' : ''} processed — here are your AI tax insights:
          </div>
          <TaxPlanningAdvice />
        </div>
      )}
    </div>
  )
}

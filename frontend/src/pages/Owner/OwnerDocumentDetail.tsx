import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDocument } from '../../api/client'
import type { TaxDocument } from '../../types'
import { 
  AlertTriangle, 
  Cpu, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Clock, 
  User,
  ArrowRight,
  ShieldCheck,
  Terminal
} from 'lucide-react'

export default function OwnerDocumentDetail() {
  const { id } = useParams()
  const [doc, setDoc] = useState<TaxDocument | null>(null)
  const [visibleSteps, setVisibleSteps] = useState<number>(0)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    if (!id) return
    getDocument(id)
      .then((data) => {
        const document = data as TaxDocument
        setDoc(document)
        
        // --- 核心演示逻辑：模拟 AI 逐步推理过程 ---
        const totalSteps = document.agent_result?.thinking_steps?.length ?? 0
        let current = 0
        const timer = setInterval(() => {
          current += 1
          setVisibleSteps(current)
          if (current >= totalSteps) clearInterval(timer)
        }, 800) // 每 0.8 秒跳出一行步骤，增加 Demo 的“智能感”
        return () => clearInterval(timer)
      })
      .catch((err) => {
        console.error("Fetch Error:", err)
        setError(true)
      })
  }, [id])

  if (error) return (
    <div className="p-20 text-center">
      <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
      <h2 className="text-xl font-bold text-gray-800">Document Fetch Failed</h2>
      <p className="text-gray-500 mt-2">Please check if the Backend API is running.</p>
    </div>
  )
  
  if (!doc) return (
    <div className="flex flex-col items-center justify-center h-screen text-gray-400 bg-gray-50">
      <Loader2 className="animate-spin mb-4 w-12 h-12 text-blue-500" />
      <p className="animate-pulse font-medium text-gray-600">TaxMate AI is analyzing your document...</p>
    </div>
  )

  const result = doc.agent_result
  const thinkingSteps = result?.thinking_steps ?? []

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 animate-in fade-in duration-700">
      {/* 顶部标题与状态栏 */}
      <div className="flex flex-wrap items-center justify-between mb-8 gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <FileText className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{doc.filename || "Receipt Document"}</h1>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck size={12} className="text-green-500" /> 
              Securely Processed • ID: {doc.id?.substring(0, 8)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm ${
            doc.status === 'approved' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'
          }`}>
            {doc.status === 'approved' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            {doc.status?.toUpperCase() || 'PROCESSED'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧：文件预览 (占 5 列) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider">
                <ImageIcon size={16} className="text-blue-500" /> Source Image
              </h2>
            </div>
            <div className="p-6 bg-gray-50/30 flex items-center justify-center min-h-[450px]">
              {/* 重点修复：显示后端传来的图片 */}
              {doc.file_url ? (
                <img 
                  src={doc.file_url} 
                  alt="Receipt Source" 
                  className="w-full rounded-xl shadow-2xl object-contain max-h-[600px] transition-transform duration-500 hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/400x600?text=Image+Load+Failed"
                  }}
                />
              ) : (
                <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-gray-200">
                  <ImageIcon size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400 italic">No image source linked in database</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0d1117] rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-[#161b22] px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-green-400 flex items-center gap-2 text-xs uppercase tracking-widest">
                <Terminal size={16} /> OCR Extraction Engine
              </h2>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
              </div>
            </div>
            <pre className="text-[11px] leading-relaxed text-green-400/90 p-6 font-mono overflow-x-auto h-56 scrollbar-thin scrollbar-thumb-gray-800">
              {doc.ocr_text || "// No raw text data detected"}
            </pre>
          </div>
        </div>

        {/* 右侧：AI 结果与思考链路 (占 7 列) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 数据提取卡片 */}
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
              <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                <Cpu size={18} /> TaxMate AI Extraction Result
              </h2>
            </div>
            <div className="p-8 grid grid-cols-2 gap-y-8 gap-x-12">
              <DetailItem label="Supplier Name" value={result?.supplier?.name || doc.supplier_name} />
              <DetailItem label="Total Amount" value={result?.amount?.total ? `RM ${result.amount.total}` : (doc.total_amount ? `RM ${doc.total_amount}` : 'N/A')} highlight />
              <DetailItem label="Tax Treatment" value={result?.tax_treatment || doc.tax_treatment} tag />
              <DetailItem label="AI Confidence" value={`${((result?.confidence || doc.confidence || 0) * 100).toFixed(1)}%`} progress />
            </div>
          </div>

          {/* 风险告警区 (Demo 时如果由于 8% SST 报错，这里会变红，非常有说服力) */}
          {result?.risk_flags && result.risk_flags.length > 0 && (
            <div className="bg-red-50/70 border border-red-100 rounded-3xl p-6 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle size={22} className="animate-pulse" />
                <h2 className="font-black text-sm uppercase">Compliance Alerts</h2>
              </div>
              <ul className="grid grid-cols-1 gap-3">
                {result.risk_flags.map((flag, i) => (
                  <li key={i} className="text-sm text-red-700 bg-white p-3 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
                    <div className="mt-1 bg-red-100 rounded-full p-1"><ArrowRight size={10} /></div>
                    {flag.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI 思考逻辑面板 (Demo 的核心亮点) */}
          <div className="bg-gray-50/50 border border-gray-100 rounded-3xl p-7 shadow-inner">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Cpu size={20} className="text-purple-600" /> 
                Agent Logic Reasoning Chain
              </h2>
              {visibleSteps < thinkingSteps.length && (
                <div className="flex items-center gap-2 text-[10px] text-purple-600 font-bold animate-pulse uppercase tracking-widest">
                  <Loader2 size={12} className="animate-spin" /> Live Processing
                </div>
              )}
            </div>
            
            <div className="space-y-5 relative before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-purple-200 before:to-transparent">
              {thinkingSteps.slice(0, visibleSteps).map((step, idx) => (
                <div key={idx} className="relative pl-10 animate-in fade-in slide-in-from-left-4 duration-500">
                  {/* 步骤圆点指示器 */}
                  <div className={`absolute left-0 top-1.5 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-500 bg-white ${
                    idx === visibleSteps - 1 ? 'border-purple-500 shadow-lg shadow-purple-100 scale-110' : 'border-gray-200'
                  }`}>
                    {idx === visibleSteps - 1 ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    ) : (
                      <CheckCircle2 size={14} className="text-green-500" />
                    )}
                  </div>
                  
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-purple-200">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">{step.type || 'SYSTEM'}</span>
                    <h4 className="text-sm font-bold text-gray-800 mt-1">{step.action}</h4>
                    {step.output && (
                      <div className="mt-3 text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-xl italic border-l-4 border-purple-400">
                        {step.output}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部审核追踪页脚 */}
          <div className="flex flex-wrap items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 text-[11px] shadow-sm">
            <div className="flex items-center gap-6 text-gray-500 font-medium">
              <span className="flex items-center gap-2"><User size={14} className="text-blue-500" /> Auditor: <b className="text-gray-800">{doc.reviewed_by || "System Assigned"}</b></span>
              <span className="flex items-center gap-2"><Clock size={14} className="text-blue-500" /> Processed: <b className="text-gray-800">{new Date(doc.updated_at || '').toLocaleString()}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 辅助子组件：详情项渲染
function DetailItem({ label, value, highlight = false, tag = false, progress = false }: { label: string, value: any, highlight?: boolean, tag?: boolean, progress?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      {tag ? (
        <div className="inline-flex px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100 uppercase shadow-sm">
          {value || 'STANDARD'}
        </div>
      ) : progress ? (
        <div className="space-y-2">
           <p className="text-sm font-black text-gray-800">{value}</p>
           <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ width: value }}></div>
           </div>
        </div>
      ) : (
        <p className={`text-sm font-extrabold truncate ${highlight ? 'text-blue-600 text-xl tracking-tight' : 'text-gray-800'}`}>
          {value || '---'}
        </p>
      )}
    </div>
  )
}
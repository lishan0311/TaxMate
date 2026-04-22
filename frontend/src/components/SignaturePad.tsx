import { useRef, useState, useEffect } from 'react'
import { PenLine, RotateCcw, CheckCircle } from 'lucide-react'

interface Props {
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export default function SignaturePad({ onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Initialise canvas white background + pen style
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getXY(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getXY(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSignature(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getXY(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDraw() {
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return
    onConfirm(canvas.toDataURL('image/png'))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4 max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <PenLine size={20} className="text-indigo-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Digital Signature</h3>
          <p className="text-xs text-slate-400">Sign using your mouse or finger</p>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 hover:border-indigo-300 transition-colors">
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <p className="text-slate-300 text-sm font-medium">Sign here...</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={560}
          height={180}
          className="w-full cursor-crosshair touch-none block"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={(e) => { e.preventDefault(); startDraw(e) }}
          onTouchMove={(e) => { e.preventDefault(); draw(e) }}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Signature line label */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorised Signature</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={clearCanvas}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
        >
          <RotateCcw size={14} />
          Clear
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors border border-slate-200"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={!hasSignature}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-sm shadow-indigo-200"
        >
          <CheckCircle size={16} />
          Confirm &amp; Apply Signature
        </button>
      </div>
    </div>
  )
}

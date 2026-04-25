import { useState, useRef, useEffect } from 'react'
import { chatWithAgent } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { MessageCircle, X, Send, Loader2, Bot, Minimize2 } from 'lucide-react'

// Fonts aligned with OwnerDashboard
const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"

interface Message {
  role: 'user' | 'ai'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'What is my total claimable input tax?',
  'Are there any high-risk receipts?',
  'When is my SST filing deadline?',
]

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')          // ## headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold**
    .replace(/\*(.+?)\*/g, '$1')           // *italic*
    .replace(/`([^`]+)`/g, '$1')           // `code`
    .replace(/^[-*]\s+/gm, '- ')           // normalize bullets to dash
    .replace(/^\|(.+)\|$/gm, (_, row) => { // markdown table → lined format
      return row.split('|').map((c: string) => c.trim()).filter(Boolean).join(': ')
    })
}

export default function OwnerChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "👋 Hi! I'm TaxMate AI — your personal tax assistant. Feel free to ask me anything about your receipts, tax records, or filing deadlines!",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { user } = useAuth()
  const clientId = user?.id

  // Auto pop-up preview bubble after 1.5s on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowPreview(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened, hide preview
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      setShowPreview(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  async function sendMessage(question?: string) {
    const q = (question ?? input).trim()
    if (!q) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await chatWithAgent({
        question: q,
        year: 2026,
        month: 4,
        client_id: clientId,
      })
      setMessages(prev => [...prev, { role: 'ai', content: res.answer }])
      if (!isOpen) setHasUnread(true)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: 'Sorry, the AI assistant is temporarily unavailable. Please try again shortly.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Chat window ── */}
      {isOpen && (
        <div
          className="fixed bottom-15 right-6 z-50 flex flex-col rounded-3xl overflow-hidden"
          style={{
            width: '360px',
            height: '520px',
            fontFamily: FONT_BODY,
            boxShadow: '0 24px 80px rgba(10,61,124,0.22)',
            border: '1.5px solid rgba(10,61,124,0.12)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0A3D7C 0%, #185FA5 100%)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#F5A623' }}
              >
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight" style={{ fontFamily: FONT_DISPLAY }}>
                  TaxMate AI
                </p>
                <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Tax Assistant
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <Minimize2 size={15} />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ background: '#F8FAFF' }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5"
                    style={{ background: '#0A3D7C' }}
                  >
                    <Bot size={12} className="text-white" />
                  </div>
                )}
                <div
                  className="text-sm px-4 py-2.5 rounded-2xl max-w-[78%] leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? {
                          background: '#0A3D7C',
                          color: '#fff',
                          borderBottomRightRadius: '4px',
                          fontWeight: 500,
                        }
                      : {
                          background: '#fff',
                          color: '#1e3a5f',
                          borderBottomLeftRadius: '4px',
                          border: '1px solid #DBEAFE',
                          fontWeight: 400,
                          whiteSpace: 'pre-wrap',
                        }
                  }
                >
                  {msg.role === 'ai' ? stripMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5"
                  style={{ background: '#0A3D7C' }}
                >
                  <Bot size={12} className="text-white" />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl flex items-center gap-2"
                  style={{ background: '#fff', border: '1px solid #DBEAFE', borderBottomLeftRadius: '4px' }}
                >
                  <Loader2 size={14} className="animate-spin" style={{ color: '#378ADD' }} />
                  <span className="text-xs" style={{ color: '#94a3b8' }}>Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggested questions — shown only at start */}
          {messages.length <= 1 && (
            <div
              className="px-4 pb-3 flex flex-wrap gap-2 shrink-0"
              style={{ background: '#F8FAFF' }}
            >
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void sendMessage(q)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-xl transition-all"
                  style={{
                    background: '#EFF6FF',
                    color: '#185FA5',
                    border: '1px solid #BFDBFE',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#EFF6FF')}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{ background: '#fff', borderTop: '1.5px solid #DBEAFE' }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Ask about your question…"
              className="flex-1 text-sm px-4 py-2.5 rounded-xl focus:outline-none"
              style={{
                background: '#F8FAFF',
                border: '1.5px solid #DBEAFE',
                color: '#1e3a5f',
                fontFamily: FONT_BODY,
              }}
              onFocus={e => (e.target.style.borderColor = '#378ADD')}
              onBlur={e => (e.target.style.borderColor = '#DBEAFE')}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: '#F5A623' }}
              onMouseEnter={e => { if (!loading && input.trim()) (e.currentTarget.style.background = '#D4881A') }}
              onMouseLeave={e => (e.currentTarget.style.background = '#F5A623')}
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Preview pop-up bubble ── */}
      {showPreview && !isOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 max-w-[260px] cursor-pointer"
          onClick={() => setIsOpen(true)}
          style={{
            animation: 'slideUpFade 0.4s ease-out',
            fontFamily: FONT_BODY,
          }}
        >
          <style>{`
            @keyframes slideUpFade {
              from { opacity: 0; transform: translateY(12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Dismiss × */}
          <button
            onClick={e => { e.stopPropagation(); setShowPreview(false) }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10"
            style={{ background: '#94a3b8' }}
          >
            ×
          </button>

          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={{
              background: '#fff',
              border: '1.5px solid #DBEAFE',
              boxShadow: '0 8px 32px rgba(10,61,124,0.16)',
              color: '#1e3a5f',
              borderBottomRightRadius: '4px',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#0A3D7C' }}
              >
                <Bot size={11} className="text-white" />
              </div>
              <span className="text-[11px] font-bold" style={{ color: '#0A3D7C', fontFamily: FONT_DISPLAY }}>
                TaxMate AI
              </span>
            </div>
            <p className="text-[12px]" style={{ color: '#334155' }}>
              👋 Hi! I'm your assistant. Feel free to ask me anything about your documents or filing!
            </p>
            <p className="text-[10px] mt-1.5 font-medium" style={{ color: '#F5A623' }}>
              Tap to chat →
            </p>
          </div>

          {/* little triangle pointing to button */}
          <div
            className="absolute -bottom-2 right-5 w-3 h-3 rotate-45"
            style={{ background: '#fff', border: '1.5px solid #DBEAFE', borderTop: 'none', borderLeft: 'none' }}
          />
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{
          background: isOpen ? '#0A3D7C' : 'linear-gradient(135deg, #0A3D7C 0%, #185FA5 100%)',
          boxShadow: '0 6px 24px rgba(10,61,124,0.35), 0 0 0 3px rgba(245,166,35,0.25)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(10,61,124,0.45), 0 0 0 4px rgba(245,166,35,0.35)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(10,61,124,0.35), 0 0 0 3px rgba(245,166,35,0.25)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
        }}
      >
        {/* Unread dot */}
        {hasUnread && !isOpen && (
          <span
            className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white"
            style={{ background: '#F5A623' }}
          />
        )}
        {isOpen
          ? <X size={20} className="text-white" />
          : <MessageCircle size={20} className="text-white" />
        }
      </button>
    </>
  )
}
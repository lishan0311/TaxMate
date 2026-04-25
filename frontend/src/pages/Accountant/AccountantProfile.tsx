// AccountantProfile.tsx
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile } from '../../api/client'
import { User, Phone, CreditCard, Save, CheckCircle2 } from 'lucide-react'

// --- Font and Color Constants ---
const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

const EXPERTISE_AREAS = [
  'Food & Beverage', 'Retail & Trading', 'Manufacturing',
  'Professional Services', 'IT & Technology', 'Construction',
  'Healthcare', 'Education', 'Logistics & Transport', 'General / SME',
]

export default function AccountantProfile() {
  const { user, login } = useAuth()
  const token = localStorage.getItem('taxmate_token') ?? ''

  const [name, setName] = useState(user?.name ?? '')
  const [icNumber, setIcNumber] = useState(user?.ic_number ?? '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? '')
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(user?.expertise_areas ?? ['General / SME'])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function toggleExpertise(area: string) {
    setExpertiseAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  async function handleSave() {
    setError('')
    if (expertiseAreas.length === 0) { setError('Select at least one expertise area.'); return }
    setSaving(true)
    try {
      const updated = await updateProfile({ name, ic_number: icNumber, phone_number: phoneNumber, expertise_areas: expertiseAreas })
      login(token, updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10 p-8 pb-32" style={{ fontFamily: FONT_BODY, color: '#334155' }}>
      
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-normal tracking-tight" style={{ color: COLOR_PRIMARY, fontFamily: FONT_DISPLAY }}>
          Accountant Profile
        </h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
          Update your details
        </p>
      </div>

      {/* Main Card - Deepen Shading */}
      <div 
        className="bg-white rounded-[2.5rem] border border-blue-50 p-10 space-y-8" 
        style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
      >

        {/* Identity Banner */}
        <div className="flex items-center gap-5 pb-8 border-b border-blue-50">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shadow-inner">
            <User size={24} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800" style={{ color: COLOR_PRIMARY }}>
              {user?.name || 'Your Name'}
            </p>
            <p className="text-xs text-slate-400 font-medium">{user?.email}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">Full Name</label>
            <div className="relative group">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aminah binti Ahmad"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">IC Number</label>
            <div className="relative group">
              <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="text"
                value={icNumber}
                onChange={(e) => setIcNumber(e.target.value)}
                placeholder="e.g. 850101-14-5678"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">Phone Number</label>
            <div className="relative group">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 011-2345678"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest ml-1">
              Expertise Areas <span className="normal-case font-medium opacity-60">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleExpertise(area)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-wider ${
                    expertiseAreas.includes(area)
                      ? 'bg-[#0A3D7C] text-white border-[#0A3D7C] shadow-md shadow-blue-900/20'
                      : 'bg-white text-slate-400 border-blue-50 hover:border-blue-200 shadow-sm'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 rounded-2xl px-5 py-3 uppercase tracking-wider">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ 
            background: saved ? '#22c55e' : COLOR_ACCENT, 
            color: 'white',
            boxShadow: saved ? '0 10px 25px -5px rgba(34,197,94,0.4)' : '0 10px 25px -5px rgba(245,166,35,0.4)'
          }}
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Changes Saved' : 'Update Profile'}
        </button>
      </div>
    </div>
  )
}
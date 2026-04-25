// Fonts used: Playfair Display (headings) + Inter (body)
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile } from '../../api/client'
import { Building2, Phone, Hash, Briefcase, Save, CheckCircle2, ChevronDown } from 'lucide-react'

const FONT_DISPLAY = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif"
const COLOR_PRIMARY = "#0A3D7C" 
const COLOR_ACCENT = "#F5A623"  

const BUSINESS_SECTORS = [
  'Food & Beverage', 'Retail & Trading', 'Manufacturing',
  'Professional Services', 'IT & Technology', 'Construction',
  'Healthcare', 'Education', 'Logistics & Transport', 'Others',
]

export default function OwnerProfile() {
  const { user, login } = useAuth()
  const token = localStorage.getItem('taxmate_token') ?? ''

  const [companyName, setCompanyName] = useState(user?.company_name ?? '')
  const [tinNumber, setTinNumber] = useState(user?.tin_number ?? '')
  const [businessSector, setBusinessSector] = useState(user?.business_sector ?? BUSINESS_SECTORS[0])
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const updated = await updateProfile({
        company_name: companyName,
        tin_number: tinNumber,
        business_sector: businessSector,
        phone_number: phoneNumber,
      })
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
          Company Profile
        </h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
          Update your company details
        </p>
      </div>

      {/* Main Card - Darken the shadows to align with Dashboard */}
      <div 
        className="bg-white rounded-[2.5rem] border border-blue-50 p-10 space-y-8" 
        style={{ boxShadow: '0 12px 40px rgba(10,61,124,0.12)' }}
      >

        {/* Company Identity Banner */}
        <div className="flex items-center gap-5 pb-8 border-b border-blue-50">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shadow-inner">
            <Building2 size={24} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800" style={{ color: COLOR_PRIMARY }}>
              {user?.company_name || 'Your Company'}
            </p>
            <p className="text-xs text-slate-400 font-medium">{user?.email}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">Company Name</label>
            <div className="relative group">
              <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. TaxMate Sdn Bhd"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">
              Company TIN Number <span className="normal-case font-medium opacity-60"></span>
            </label>
            <div className="relative group">
              <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="text"
                value={tinNumber}
                onChange={(e) => setTinNumber(e.target.value)}
                placeholder="e.g. W10-2604-32000123"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">
              Phone Number <span className="normal-case font-medium opacity-60"></span>
            </label>
            <div className="relative group">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 012-3456789"
                className="w-full pl-11 pr-4 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest ml-1">Business Sector</label>
            <div className="relative group">
              <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 transition-colors group-focus-within:text-blue-400" />
              <select
                value={businessSector}
                onChange={(e) => setBusinessSector(e.target.value)}
                className="appearance-none w-full pl-11 pr-10 py-3 border border-blue-50 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-700 shadow-sm bg-white cursor-pointer"
              >
                {BUSINESS_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300" />
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
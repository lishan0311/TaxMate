import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile } from '../../api/client'
import { Building2, Phone, Hash, Briefcase, Save, CheckCircle2 } from 'lucide-react'

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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Company Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Update your company details used in SST-02 filings.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{user?.company_name ?? 'Your Company'}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Company Name</label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. TaxMate Sdn Bhd"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Company TIN Number <span className="text-slate-400 normal-case font-normal">(SST-02 form)</span>
          </label>
          <div className="relative">
            <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tinNumber}
              onChange={(e) => setTinNumber(e.target.value)}
              placeholder="e.g. W10-2604-32000123"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Phone Number <span className="text-slate-400 normal-case font-normal">(SST-02 form)</span>
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 012-3456789"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Business Sector</label>
          <div className="relative">
            <Briefcase size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={businessSector}
              onChange={(e) => setBusinessSector(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
            >
              {BUSINESS_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

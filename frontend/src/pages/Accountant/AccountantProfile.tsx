import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile } from '../../api/client'
import { User, Phone, CreditCard, Save, CheckCircle2 } from 'lucide-react'

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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Accountant Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Update your details used in SST-02 signatures and client matching.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <User size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{user?.name ?? 'Your Name'}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name</label>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aminah binti Ahmad"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">IC Number</label>
          <div className="relative">
            <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={icNumber}
              onChange={(e) => setIcNumber(e.target.value)}
              placeholder="e.g. 850101-14-5678"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Phone Number</label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 011-2345678"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
            Expertise Areas <span className="text-slate-400 normal-case font-normal">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleExpertise(area)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  expertiseAreas.includes(area)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

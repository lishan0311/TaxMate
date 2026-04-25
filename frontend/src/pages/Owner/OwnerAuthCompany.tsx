import { useState } from 'react'
import type { CompanyProfile } from '../../types'
import { getOwnerAuth, saveOwnerAuth } from '../../lib/storage'

interface Props {
  onDone: () => void
}

const defaultProfile: CompanyProfile = {
  companyName: '',
  tin: '',
  ssmNo: '',
  sstNo: '',
  turnoverBand: 'RM 0 - 500k',
  industry: 'F&B',
}

export default function OwnerAuthCompany({ onDone }: Props) {
  const existing = getOwnerAuth()
  const [email, setEmail] = useState(existing?.email ?? '')
  const [password, setPassword] = useState(existing?.password ?? '')
  const [profile, setProfile] = useState<CompanyProfile>(existing?.companyProfile ?? defaultProfile)

  function updateProfile<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  function submit() {
    saveOwnerAuth({ email, password, companyProfile: profile })
    onDone()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">1.1 Register & Login</h2>
        <div className="space-y-3">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Company Information</h2>
        <div className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Company Name" value={profile.companyName} onChange={(e) => updateProfile('companyName', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="TIN" value={profile.tin} onChange={(e) => updateProfile('tin', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="SSM Number" value={profile.ssmNo} onChange={(e) => updateProfile('ssmNo', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="SST Registration Number" value={profile.sstNo} onChange={(e) => updateProfile('sstNo', e.target.value)} />
          <select className="w-full border rounded-lg px-3 py-2" value={profile.turnoverBand} onChange={(e) => updateProfile('turnoverBand', e.target.value)}>
            <option>RM 0 - 500k</option>
            <option>RM 500k - 1M</option>
            <option>RM 1M - 5M</option>
            <option>RM 5M+</option>
          </select>
          <select className="w-full border rounded-lg px-3 py-2" value={profile.industry} onChange={(e) => updateProfile('industry', e.target.value)}>
            <option>F&B</option>
            <option>Retail</option>
            <option>Logistics</option>
            <option>Professional Service</option>
          </select>
          <p className="text-xs text-gray-500">Industry for subsequent MSIC classification code suggestions (currently placeholder on the frontend).</p>
        </div>
      </section>

      <div>
        <button onClick={submit} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700">
          Save and Enter Owner Dashboard
        </button>
      </div>
    </div>
  )
}

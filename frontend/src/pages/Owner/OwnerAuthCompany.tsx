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
        <h2 className="text-xl font-semibold mb-4">1.1 注册登录</h2>
        <div className="space-y-3">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">公司资料</h2>
        <div className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="公司名称" value={profile.companyName} onChange={(e) => updateProfile('companyName', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="TIN" value={profile.tin} onChange={(e) => updateProfile('tin', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="SSM 号" value={profile.ssmNo} onChange={(e) => updateProfile('ssmNo', e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="SST 注册号" value={profile.sstNo} onChange={(e) => updateProfile('sstNo', e.target.value)} />
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
          <p className="text-xs text-gray-500">行业用于后续 MSIC 分类代码建议（当前先做前端占位）。</p>
        </div>
      </section>

      <div>
        <button onClick={submit} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700">
          保存并进入老板端
        </button>
      </div>
    </div>
  )
}

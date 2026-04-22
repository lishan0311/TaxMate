import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loginUser, registerClient, registerAccountant } from '../api/client'
import { Eye, EyeOff, Building2, UserCheck, ChevronRight, AlertCircle } from 'lucide-react'

type Mode = 'login' | 'register'
type Role = 'client' | 'accountant'

const BUSINESS_SECTORS = [
  'Food & Beverage',
  'Retail & Trading',
  'Manufacturing',
  'Professional Services',
  'IT & Technology',
  'Construction',
  'Healthcare',
  'Education',
  'Logistics & Transport',
  'Others',
]

const EXPERTISE_AREAS = [
  'Food & Beverage',
  'Retail & Trading',
  'Manufacturing',
  'Professional Services',
  'IT & Technology',
  'Construction',
  'Healthcare',
  'Education',
  'Logistics & Transport',
  'General / SME',
]

export default function LoginPage() {
  const { login } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<Role>('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // Shared
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Client register
  const [companyName, setCompanyName] = useState('')
  const [tinNumber, setTinNumber] = useState('')
  const [businessSector, setBusinessSector] = useState(BUSINESS_SECTORS[0])
  const [clientPhone, setClientPhone] = useState('')

  // Accountant register
  const [name, setName] = useState('')
  const [icNumber, setIcNumber] = useState('')
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(['General / SME'])
  const [accountantPhone, setAccountantPhone] = useState('')

  function toggleExpertise(area: string) {
    setExpertiseAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    )
  }

  async function handleSubmit() {
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please fill in email and password.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        try {
          const res = await loginUser({ email, password })
          login(res.token, res.user)
        } catch (loginErr: unknown) {
          // Demo fallback: if backend is unreachable or user not registered,
          // create a local demo session so the UI is still explorable.
          const e = loginErr as { response?: { status?: number }; code?: string }
          const isNetworkError = !e.response || e.code === 'ERR_NETWORK'
          const isNotFound = e.response?.status === 401
          if (isNetworkError || isNotFound) {
            const demoUser = {
              id: `demo-${Date.now()}`,
              email,
              role: role as 'client' | 'accountant',
              ...(role === 'client'
                ? { company_name: 'Demo Company Sdn Bhd', tin_number: 'W10-0000-00000000', business_sector: 'Others' }
                : { name: email.split('@')[0], ic_number: '000000-00-0000', expertise_areas: ['General / SME'] }),
            }
            login('demo-token', demoUser)
            return
          }
          throw loginErr
        }
      } else if (role === 'client') {
        if (!companyName.trim() || !tinNumber.trim()) {
          setError('Please fill in company name and TIN number.')
          setLoading(false)
          return
        }
        const res = await registerClient({
          email,
          password,
          company_name: companyName,
          tin_number: tinNumber,
          business_sector: businessSector,
          phone_number: clientPhone || undefined,
        })
        login(res.token, res.user)
      } else {
        if (!name.trim() || !icNumber.trim()) {
          setError('Please fill in your name and IC number.')
          setLoading(false)
          return
        }
        if (expertiseAreas.length === 0) {
          setError('Please select at least one expertise area.')
          setLoading(false)
          return
        }
        const res = await registerAccountant({
          email,
          password,
          name,
          ic_number: icNumber,
          expertise_areas: expertiseAreas,
          phone_number: accountantPhone || undefined,
        })
        login(res.token, res.user)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(e.response?.data?.detail || e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200">
            <span className="text-white text-2xl font-black">T</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">TaxMate</h1>
          <p className="text-sm text-slate-400">Malaysia SST Compliance Platform</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'login' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'register' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Register
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">

          {/* Role toggle (always visible) */}
          <div className="flex bg-slate-50 rounded-xl p-1">
            <button
              onClick={() => { setRole('client'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                role === 'client' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Building2 size={15} />
              Business Owner
            </button>
            <button
              onClick={() => { setRole('accountant'); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                role === 'accountant' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserCheck size={15} />
              Accountant
            </button>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* ── Client Register fields ── */}
          {mode === 'register' && role === 'client' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. TaxMate Sdn Bhd"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Company TIN Number
                  <span className="ml-1 text-slate-400 normal-case font-normal">(for SST-02 form)</span>
                </label>
                <input
                  type="text"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                  placeholder="e.g. W10-2604-32000123"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Business Sector
                  <span className="ml-1 text-slate-400 normal-case font-normal">(for accountant matching)</span>
                </label>
                <select
                  value={businessSector}
                  onChange={(e) => setBusinessSector(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                >
                  {BUSINESS_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Phone Number
                  <span className="ml-1 text-slate-400 normal-case font-normal">(for SST-02 form)</span>
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. 012-3456789"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
            </>
          )}

          {/* ── Accountant Register fields ── */}
          {mode === 'register' && role === 'accountant' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aminah binti Ahmad"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  IC Number
                </label>
                <input
                  type="text"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  placeholder="e.g. 850101-14-5678"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  Expertise Areas
                  <span className="ml-1 text-slate-400 normal-case font-normal">(select all that apply)</span>
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

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={accountantPhone}
                  onChange={(e) => setAccountantPhone(e.target.value)}
                  placeholder="e.g. 011-2345678"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm ${
              role === 'accountant'
                ? 'bg-linear-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-100'
                : 'bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-100'
            }`}
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Demo hint */}
        {mode === 'login' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Demo — any email + any password works</p>
            <p className="text-xs text-slate-400">
              Select <span className="font-semibold text-blue-600">Business Owner</span> or{' '}
              <span className="font-semibold text-indigo-600">Accountant</span> role, enter any email and password to log in as a demo user.
              To try real auth, register a new account first.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

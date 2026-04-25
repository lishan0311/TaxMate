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
  const [accountantEmail, setAccountantEmail] = useState('')

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
          const e = loginErr as { response?: { data?: { detail?: string } }; message?: string }
          setError(e.response?.data?.detail || e.message || 'Invalid email or password.')
          setLoading(false)
          return
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
          accountant_email: accountantEmail || undefined,
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(150deg, #0A3D7C 0%, #185FA5 55%, #1e70bf 75%, #F5A623 160%)',
      }}
    >
      {/* Decorative blobs */}
      <div
        className="pointer-events-none fixed top-0 right-0 w-72 h-72 rounded-full"
        style={{ background: 'rgba(245,166,35,0.18)', transform: 'translate(30%, -30%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 w-56 h-56 rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)', transform: 'translate(-30%, 30%)' }}
      />

      <div className="w-full max-w-md space-y-5 relative z-10">

        {/* Logo */}
        <div className="text-center space-y-2">
          <img
            src="/TaxMate_logo.png"
            alt="TaxMate"
            className="inline-block w-24 h-24 rounded-2xl object-contain"
            style={{ boxShadow: '0 5px 24px rgba(255,255,255,0.25)', background: 'rgba(255,255,255,1)', padding: '12px', borderRadius: '16px' }}
          />
          <h1 className="text-2xl font-black text-white tracking-tight">TaxMate</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Malaysia SST Compliance Platform</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-white/10 border border-white/20 rounded-2xl p-1">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={
              mode === 'login'
                ? { background: '#0A3D7C', color: '#fff' }
                : { color: 'rgba(255,255,255,0.7)' }
            }
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={
              mode === 'register'
                ? { background: '#0A3D7C', color: '#fff' }
                : { color: 'rgba(255,255,255,0.7)' }
            }
          >
            Register
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4" style={{ boxShadow: '0 8px 40px rgba(10,61,124,0.22)' }}>

          {/* Role toggle (always visible) */}
          <div className="flex rounded-xl p-1" style={{ background: '#E6F1FB' }}>
            <button
              onClick={() => { setRole('client'); setError('') }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all"
              style={
                role === 'client'
                  ? { background: '#0A3D7C', color: '#fff' }
                  : { color: '#185FA5' }
              }
            >
              <Building2 size={15} />
              Business Owner
            </button>
            <button
              onClick={() => { setRole('accountant'); setError('') }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all"
              style={
                role === 'accountant'
                  ? { background: '#F5A623', color: '#fff' }
                  : { color: '#185FA5' }
              }
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
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50"
              style={{ '--tw-ring-color': '#185FA5' } as React.CSSProperties}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
              onBlur={e => e.target.style.boxShadow = ''}
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
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                onBlur={e => e.target.style.boxShadow = ''}
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
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                  onBlur={e => e.target.style.boxShadow = ''}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Company TIN Number
                  <span className="ml-1 text-slate-400 normal-case font-normal"></span>
                </label>
                <input
                  type="text"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                  placeholder="e.g. W10-2604-32000123"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                  onBlur={e => e.target.style.boxShadow = ''}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Business Sector
                  <span className="ml-1 text-slate-400 normal-case font-normal"></span>
                </label>
                <select
                  value={businessSector}
                  onChange={(e) => setBusinessSector(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                  onBlur={e => e.target.style.boxShadow = ''}
                >
                  {BUSINESS_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Phone Number
                  <span className="ml-1 text-slate-400 normal-case font-normal"></span>
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. 012-3456789"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                  onBlur={e => e.target.style.boxShadow = ''}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Accountant Email
                  <span className="ml-1 text-slate-400 normal-case font-normal">(optional binding)</span>
                </label>
                <input
                  type="email"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  placeholder="e.g. accountant@taxmate.com"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #185FA5'}
                  onBlur={e => e.target.style.boxShadow = ''}
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
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #F5A623'}
                  onBlur={e => e.target.style.boxShadow = ''}
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
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #F5A623'}
                  onBlur={e => e.target.style.boxShadow = ''}
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
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                      style={
                        expertiseAreas.includes(area)
                          ? { background: '#F5A623', color: '#fff', borderColor: '#F5A623' }
                          : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }
                      }
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
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-slate-50"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #F5A623'}
                  onBlur={e => e.target.style.boxShadow = ''}
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
            className="w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 text-white"
            style={
              role === 'accountant'
                ? { background: '#F5A623', boxShadow: '0 2px 12px rgba(245,166,35,0.35)' }
                : { background: '#0A3D7C', boxShadow: '0 2px 12px rgba(10,61,124,0.3)' }
            }
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
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}
          >
            <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.88)' }}>
              Demo — any email + any password works
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.58)' }}>
              Select <span className="font-semibold" style={{ color: '#93C5FD' }}>Business Owner</span> or{' '}
              <span className="font-semibold" style={{ color: '#FCD34D' }}>Accountant</span> role, enter any email and password to log in as a demo user.
              To try real auth, register a new account first.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
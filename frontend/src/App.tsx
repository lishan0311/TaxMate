import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import OwnerDashboard from './pages/Owner/OwnerDashboard'
import OwnerUpload from './pages/Owner/OwnerUpload'
import OwnerDocuments from './pages/Owner/OwnerDocuments'
import OwnerDocumentDetail from './pages/Owner/OwnerDocumentDetail'
import OwnerDownloads from './pages/Owner/OwnerDownloads'
import OwnerProfile from './pages/Owner/OwnerProfile'
import AccountantClients from './pages/Accountant/AccountantClients'
import AccountantQueue from './pages/Accountant/AccountantQueue'
import AccountantWorkbench from './pages/Accountant/AccountantWorkbench'
import AccountantEfficiency from './pages/Accountant/AccountantEfficiency'
import AccountantProfile from './pages/Accountant/AccountantProfile'
import TaxInsights from './pages/Owner/TaxInsights'
import OwnerChatbot from './pages/Owner/OwnerChatbot'   // ← 新增

const queryClient = new QueryClient()

function AppShell() {
  const { user, logout } = useAuth()

  if (!user) {
    return <LoginPage />
  }

  const role = user.role
  const displayName =
    role === 'client'
      ? user.company_name || user.email.split('@')[0]
      : user.name || user.email.split('@')[0]

  const isClient = role === 'client'

  return (
    <BrowserRouter>
      {/* Full-page background */}
      <div className="min-h-screen" style={{ background: '#EFF6FF' }}>

        {/* Navbar */}
        <nav
          className="px-6 py-0"
          style={{
            background: 'linear-gradient(135deg, #0A3D7C 0%, #185FA5 100%)',
            boxShadow: '0 2px 16px rgba(10,61,124,0.18)',
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between h-14">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src="/TaxMate_logo.png"
                alt="TaxMate"
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-lg font-bold text-white tracking-tight">TaxMate</span>
            </Link>

            {/* Nav links + user */}
            <div className="flex items-center gap-1">
              {isClient ? (
                <>
                  <NavLink to="/owner/dashboard">Dashboard</NavLink>
                  <NavLink to="/owner/documents">Documents</NavLink>
                  <NavLink to="/owner/report">Tax Insights</NavLink>
                  <NavLink to="/owner/downloads">Downloads</NavLink>
                  <NavLink to="/owner/profile">Profile</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/accountant/clients">Clients</NavLink>
                  <NavLink to="/accountant/efficiency">Efficiency</NavLink>
                  <NavLink to="/accountant/profile">Profile</NavLink>
                </>
              )}

              <div className="w-px h-5 mx-2" style={{ background: 'rgba(255,255,255,0.6)' }} />

              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ 
                  background: 'rgba(255,255,255,0.12)', 
                  border: '1.5px solid rgba(255,255,255,0.8)'
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: isClient ? '#F5A623' : '#93C5FD' }}
                />
                <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                  {displayName}
                </span>
                <span
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md"
                  style={
                    isClient
                      ? { background: 'rgba(245,166,35,0.25)', color: '#FDE68A' }
                      : { background: 'rgba(147,197,253,0.2)', color: '#BAE6FD' }
                  }
                >
                  {isClient ? 'Owner' : 'Accountant'}
                </span>
              </div>

              <button
                onClick={logout}
                className="ml-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-95 shadow-md"
                style={{ 
                  background: '#F5A623', 
                  color: '#ffffff', 
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 0 12px rgba(245,166,35,0.4), 0 4px 8px rgba(0,0,0,0.3)'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#ffad26'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(245,166,35,0.6), 0 6px 12px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#F5A623'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(245,166,35,0.4), 0 4px 8px rgba(0,0,0,0.3)'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-6xl mx-auto py-8 px-6">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={isClient ? '/owner/dashboard' : '/accountant/clients'} />}
            />
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            <Route path="/owner/upload" element={<OwnerUpload />} />
            <Route path="/owner/documents" element={<OwnerDocuments />} />
            <Route path="/owner/documents/:id" element={<OwnerDocumentDetail />} />
            <Route path="/owner/report" element={<TaxInsights role="owner" />} />
            <Route path="/owner/downloads" element={<OwnerDownloads />} />
            <Route path="/owner/profile" element={<OwnerProfile />} />
            <Route path="/accountant/clients" element={<AccountantClients />} />
            <Route path="/accountant/queue" element={<AccountantQueue />} />
            <Route path="/accountant/workbench/:id" element={<AccountantWorkbench />} />
            <Route path="/accountant/workbench" element={<AccountantWorkbench />} />
            <Route path="/accountant/report" element={<TaxInsights role="accountant" />} />
            <Route path="/accountant/efficiency" element={<AccountantEfficiency />} />
            <Route path="/accountant/profile" element={<AccountantProfile />} />
          </Routes>
        </main>

        {isClient && <OwnerChatbot />}

      </div>
    </BrowserRouter>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all text-white hover:bg-white/10"
    >
      {children}
    </Link>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  )
}
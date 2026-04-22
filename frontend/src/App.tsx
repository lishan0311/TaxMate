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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-blue-600">
              TaxMate
            </Link>

            <div className="flex items-center gap-4">
              {role === 'client' ? (
                <>
                  <Link to="/owner/dashboard" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">Dashboard</Link>
                  <Link to="/owner/documents" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">Documents</Link>
                  <Link to="/owner/report" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">Tax Insights</Link>
                  <Link to="/owner/downloads" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">Downloads</Link>
                  <Link to="/owner/profile" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">Profile</Link>
                </>
              ) : (
                <>
                  <Link to="/accountant/clients" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Clients</Link>
                  <Link to="/accountant/efficiency" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Efficiency</Link>
                  <Link to="/accountant/profile" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Profile</Link>
                </>
              )}

              {/* User badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className={`w-2 h-2 rounded-full ${role === 'client' ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                <span className="text-xs font-semibold text-slate-600 max-w-30 truncate">{displayName}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                  role === 'client' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {role === 'client' ? 'Owner' : 'Accountant'}
                </span>
              </div>

              <button
                onClick={logout}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto py-8 px-6">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={role === 'client' ? '/owner/dashboard' : '/accountant/clients'} />}
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
      </div>
    </BrowserRouter>
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

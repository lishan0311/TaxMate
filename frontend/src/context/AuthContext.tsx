import { createContext, useContext, useState } from 'react'

export interface UserInfo {
  id: string
  email: string
  role: 'client' | 'accountant'
  phone_number?: string | null
  bound_accountant_id?: string | null
  // Client fields
  company_name?: string | null
  tin_number?: string | null
  business_sector?: string | null
  // Accountant fields
  name?: string | null
  ic_number?: string | null
  expertise_areas?: string[]
}

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  login: (token: string, user: UserInfo) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
})

function loadFromStorage(): { user: UserInfo | null; token: string | null } {
  try {
    const token = localStorage.getItem('taxmate_token')
    const raw = localStorage.getItem('taxmate_user')
    const user = raw ? (JSON.parse(raw) as UserInfo) : null
    return { token, user }
  } catch {
    return { user: null, token: null }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = loadFromStorage()
  const [user, setUser] = useState<UserInfo | null>(stored.user)
  const [token, setToken] = useState<string | null>(stored.token)

  function login(newToken: string, newUser: UserInfo) {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('taxmate_token', newToken)
    localStorage.setItem('taxmate_user', JSON.stringify(newUser))
    // Force redirect to correct home page based on role
    const home = newUser.role === 'client' ? '/owner/dashboard' : '/accountant/clients'
    window.location.href = home
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('taxmate_token')
    localStorage.removeItem('taxmate_user')
    // Force redirect to login page, clearing any stale URL
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

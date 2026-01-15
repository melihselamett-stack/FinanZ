import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, UserInfo } from '../services/api'

interface AuthContextType {
  user: UserInfo | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  googleLogin: (idToken: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password)
      if (response.data.success && response.data.token && response.data.user) {
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
        setUser(response.data.user)
      } else {
        throw new Error(response.data.message || 'Giriş başarısız')
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message)
      }
      if (error.response?.status === 401) {
        throw new Error('Geçersiz email veya şifre')
      }
      throw error
    }
  }

  const register = async (email: string, password: string, fullName: string) => {
    try {
      const response = await authApi.register(email, password, fullName)
      if (response.data.success && response.data.token && response.data.user) {
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
        setUser(response.data.user)
      } else {
        throw new Error(response.data.message || 'Kayıt başarısız')
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message)
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Geçersiz bilgiler. Lütfen kontrol edin.')
      }
      throw error
    }
  }

  const googleLogin = async (idToken: string) => {
    const response = await authApi.googleLogin(idToken)
    if (response.data.success && response.data.token && response.data.user) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      setUser(response.data.user)
    } else {
      throw new Error(response.data.message || 'Google ile giriş başarısız')
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, SESSION_EXPIRED } from './api'

export type Role = 'organizer' | 'superadmin'
export interface User { id: number; name: string; email: string | null; phone: string | null; role: Role }

interface AuthState {
  user: User | null
  loading: boolean
  // login: telemóvel ou e-mail, no mesmo campo.
  login: (login: string, password: string) => Promise<void>
  register: (data: { name: string; email?: string; phone?: string; password: string; password_confirmation: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/me').catch(() => null),
    staleTime: Infinity,
  })

  // Sessão expirada a meio do uso: o Protected redireciona para /entrar.
  useEffect(() => {
    const onExpired = () => {
      if (!qc.getQueryData(['me'])) return
      qc.setQueryData(['me'], null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    }
    window.addEventListener(SESSION_EXPIRED, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired)
  }, [qc])

  const login = async (login: string, password: string) => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    qc.setQueryData(['me'], await api<User>('/login', 'POST', { login, password, remember: true }))
  }
  const register: AuthState['register'] = async (body) => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    qc.setQueryData(['me'], await api<User>('/register', 'POST', body))
  }
  const logout = async () => {
    try { await api('/logout', 'POST') } finally {
      qc.setQueryData(['me'], null)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    }
  }

  return <AuthContext value={{ user: data ?? null, loading: isLoading, login, register, logout }}>{children}</AuthContext>
}

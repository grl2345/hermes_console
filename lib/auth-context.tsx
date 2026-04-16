'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from './types'
import { api } from './api-client'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 启动时通过 API 验证当前登录状态
  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await api.post<{ user: User }>('/auth/login', { email, password })
      setUser(data.user)
      return true
    } catch {
      return false
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const data = await api.post<{ user: User }>('/auth/register', { email, password, name })
      setUser(data.user)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // 即使 API 失败也要清除前端状态
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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

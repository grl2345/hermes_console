'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock 用户数据
const MOCK_USERS: { email: string; password: string; user: User }[] = [
  {
    email: 'admin@hermes.ai',
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@hermes.ai',
      name: '管理员',
    },
  },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 检查本地存储的登录状态
    const stored = localStorage.getItem('hermes_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('hermes_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // 模拟 API 延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const found = MOCK_USERS.find(u => u.email === email && u.password === password)
    if (found) {
      setUser(found.user)
      localStorage.setItem('hermes_user', JSON.stringify(found.user))
      return true
    }
    return false
  }

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    // 模拟 API 延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 检查邮箱是否已存在
    if (MOCK_USERS.some(u => u.email === email)) {
      return false
    }
    
    const newUser: User = {
      id: String(MOCK_USERS.length + 1),
      email,
      name,
    }
    
    MOCK_USERS.push({ email, password, user: newUser })
    setUser(newUser)
    localStorage.setItem('hermes_user', JSON.stringify(newUser))
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('hermes_user')
  }

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

// 客户端 API 调用工具
// 所有页面通过这个模块调用 /api/* 路由，由 Next.js 服务端代理到远程服务器

const API_BASE = '/api'

interface ApiError {
  message: string
  status: number
}

class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      // 认证失败，跳转登录
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new ApiClientError('未认证', 401)
    }
    let message = `请求失败 (${res.status})`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {}
    throw new ApiClientError(message, res.status)
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}

export { ApiClientError }

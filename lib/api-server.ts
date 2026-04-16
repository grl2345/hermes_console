// 服务端代理工具 —— 仅在 Next.js API Route Handlers 中使用
// 负责将请求转发到远程服务器 (43.173.76.121)

const REMOTE_SERVER_URL = process.env.REMOTE_SERVER_URL || 'http://43.173.76.121:8080'
const REMOTE_SERVER_API_KEY = process.env.REMOTE_SERVER_API_KEY || ''

interface RemoteRequestOptions {
  method?: string
  body?: unknown
  timeout?: number
}

class RemoteServerError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'RemoteServerError'
    this.status = status
  }
}

export async function remoteRequest<T>(
  path: string,
  options: RemoteRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, timeout = 30000 } = options

  const url = `${REMOTE_SERVER_URL}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (REMOTE_SERVER_API_KEY) {
      headers['Authorization'] = `Bearer ${REMOTE_SERVER_API_KEY}`
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      let message = `远程服务器错误 (${res.status})`
      try {
        const data = await res.json()
        message = data.error || data.message || message
      } catch {}
      throw new RemoteServerError(message, res.status)
    }

    if (res.status === 204) {
      return undefined as T
    }

    return res.json()
  } catch (err) {
    if (err instanceof RemoteServerError) throw err
    if ((err as Error).name === 'AbortError') {
      throw new RemoteServerError('远程服务器请求超时', 504)
    }
    throw new RemoteServerError(
      `无法连接远程服务器: ${(err as Error).message}`,
      502,
    )
  } finally {
    clearTimeout(timer)
  }
}

// 用于 SSE 日志流的连接
export function createRemoteLogStream(agentId: string): ReadableStream {
  const url = `${REMOTE_SERVER_URL}/agents/${agentId}/logs?follow=true`

  return new ReadableStream({
    async start(controller) {
      try {
        const headers: Record<string, string> = {}
        if (REMOTE_SERVER_API_KEY) {
          headers['Authorization'] = `Bearer ${REMOTE_SERVER_API_KEY}`
        }

        const res = await fetch(url, { headers })
        if (!res.ok || !res.body) {
          controller.close()
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          controller.enqueue(new TextEncoder().encode(`data: ${text}\n\n`))
        }
      } catch {
        // 连接断开，关闭流
      } finally {
        controller.close()
      }
    },
  })
}

// 构建 JSON 响应的辅助函数
export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function errorResponse(message: string, status = 500) {
  return Response.json({ error: message }, { status })
}

export { RemoteServerError }

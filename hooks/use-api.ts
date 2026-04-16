'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api-client'

interface UseApiResult<T> {
  data: T | undefined
  isLoading: boolean
  error: string | null
  mutate: () => void
}

// 通用数据获取 hook，支持轮询
export function useApi<T>(
  path: string | null, // null 表示不请求
  options?: { refreshInterval?: number },
): UseApiResult<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pathRef = useRef(path)
  pathRef.current = path

  const fetchData = useCallback(async () => {
    if (!pathRef.current) {
      setIsLoading(false)
      return
    }
    try {
      const result = await api.get<T>(pathRef.current)
      setData(result)
      setError(null)
    } catch (err: any) {
      setError(err.message || '请求失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!path) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetchData()

    if (options?.refreshInterval) {
      const interval = setInterval(fetchData, options.refreshInterval)
      return () => clearInterval(interval)
    }
  }, [path, options?.refreshInterval, fetchData])

  return { data, isLoading, error, mutate: fetchData }
}

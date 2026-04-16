'use client'

import { useApi } from './use-api'
import type { ServerInfo } from '@/lib/types'

interface DashboardStats {
  onlineCount: number
  totalAgents: number
  activeTaskCount: number
  todayCompleted: number
  todayTokens: number
}

export function useDashboardStats(refreshInterval?: number) {
  return useApi<DashboardStats>('/dashboard/stats', { refreshInterval })
}

export function useServerInfo(refreshInterval?: number) {
  return useApi<ServerInfo>('/server/info', { refreshInterval })
}

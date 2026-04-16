'use client'

import { useApi } from './use-api'
import type { Task } from '@/lib/types'

export function useTasks(agentId?: string, refreshInterval?: number) {
  const path = agentId ? `/tasks?agentId=${agentId}` : '/tasks'
  return useApi<Task[]>(path, { refreshInterval })
}

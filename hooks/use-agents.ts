'use client'

import { useApi } from './use-api'
import { api } from '@/lib/api-client'
import type { Agent } from '@/lib/types'

export function useAgents(refreshInterval?: number) {
  return useApi<Agent[]>('/agents', { refreshInterval })
}

export function useAgent(id: string | null) {
  return useApi<Agent>(id ? `/agents/${id}` : null)
}

export async function createAgent(data: {
  name: string
  shortName: string
  role: string
  model: string
  skills: string[]
}) {
  return api.post<Agent>('/agents', data)
}

export async function agentAction(id: string, action: 'start' | 'stop' | 'restart') {
  return api.post<{ success: boolean }>(`/agents/${id}/${action}`)
}

export async function deleteAgent(id: string) {
  return api.delete<{ success: boolean }>(`/agents/${id}`)
}

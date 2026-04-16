'use client'

import { useApi } from './use-api'
import { api } from '@/lib/api-client'
import type { Skill } from '@/lib/types'

export function useSkills(agentId?: string) {
  const path = agentId ? `/skills?agentId=${agentId}` : '/skills'
  return useApi<Skill[]>(path)
}

export function useSkill(id: string | null) {
  return useApi<Skill>(id ? `/skills/${id}` : null)
}

export async function updateSkill(id: string, data: { content: string }) {
  return api.put<Skill>(`/skills/${id}`, data)
}

export async function createSkill(data: {
  agentId: string
  name: string
  content: string
}) {
  return api.post<Skill>('/skills', data)
}

export async function deleteSkill(id: string) {
  return api.delete<{ success: boolean }>(`/skills/${id}`)
}

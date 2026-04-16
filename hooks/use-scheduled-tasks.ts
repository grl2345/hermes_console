'use client'

import { useApi } from './use-api'
import { api } from '@/lib/api-client'
import type { ScheduledTask } from '@/lib/types'

export function useScheduledTasks(agentId?: string) {
  const path = agentId ? `/scheduled-tasks?agentId=${agentId}` : '/scheduled-tasks'
  return useApi<ScheduledTask[]>(path)
}

export async function createScheduledTask(data: {
  name: string
  cron: string
  cronDescription: string
  agentId: string
}) {
  return api.post<ScheduledTask>('/scheduled-tasks', data)
}

export async function updateScheduledTask(id: string, data: Partial<ScheduledTask>) {
  return api.put<ScheduledTask>(`/scheduled-tasks/${id}`, data)
}

export async function deleteScheduledTask(id: string) {
  return api.delete<{ success: boolean }>(`/scheduled-tasks/${id}`)
}

export async function toggleScheduledTask(id: string, enabled: boolean) {
  return api.patch<ScheduledTask>(`/scheduled-tasks/${id}/toggle`, { enabled })
}

export async function runScheduledTask(id: string) {
  return api.post<{ success: boolean }>(`/scheduled-tasks/${id}/run`)
}

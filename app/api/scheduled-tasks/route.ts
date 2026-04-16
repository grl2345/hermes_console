import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { ScheduledTask } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const path = agentId ? `/scheduled-tasks?agentId=${agentId}` : '/scheduled-tasks'
    const tasks = await remoteRequest<ScheduledTask[]>(path)
    return jsonResponse(tasks)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const task = await remoteRequest<ScheduledTask>('/scheduled-tasks', {
      method: 'POST',
      body,
    })
    return jsonResponse(task, 201)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

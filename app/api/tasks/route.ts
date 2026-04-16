import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Task } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const path = agentId ? `/tasks?agentId=${agentId}` : '/tasks'
    const tasks = await remoteRequest<Task[]>(path)
    return jsonResponse(tasks)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

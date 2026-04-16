import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Task } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const task = await remoteRequest<Task>(`/tasks/${id}`)
    return jsonResponse(task)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

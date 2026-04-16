import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { ScheduledTask } from '@/lib/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const task = await remoteRequest<ScheduledTask>(`/scheduled-tasks/${id}/toggle`, {
      method: 'PATCH',
      body,
    })
    return jsonResponse(task)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

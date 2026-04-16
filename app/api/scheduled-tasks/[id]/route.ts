import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { ScheduledTask } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const task = await remoteRequest<ScheduledTask>(`/scheduled-tasks/${id}`)
    return jsonResponse(task)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const task = await remoteRequest<ScheduledTask>(`/scheduled-tasks/${id}`, {
      method: 'PUT',
      body,
    })
    return jsonResponse(task)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await remoteRequest(`/scheduled-tasks/${id}`, { method: 'DELETE' })
    return jsonResponse({ success: true })
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

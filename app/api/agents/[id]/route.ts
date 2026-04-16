import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Agent } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const agent = await remoteRequest<Agent>(`/agents/${id}`)
    return jsonResponse(agent)
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
    await remoteRequest(`/agents/${id}`, { method: 'DELETE' })
    return jsonResponse({ success: true })
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

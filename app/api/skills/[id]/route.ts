import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Skill } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const skill = await remoteRequest<Skill>(`/skills/${id}`)
    return jsonResponse(skill)
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
    const skill = await remoteRequest<Skill>(`/skills/${id}`, {
      method: 'PUT',
      body,
    })
    return jsonResponse(skill)
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
    await remoteRequest(`/skills/${id}`, { method: 'DELETE' })
    return jsonResponse({ success: true })
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

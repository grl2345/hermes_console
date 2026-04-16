import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await remoteRequest(`/agents/${id}/stop`, { method: 'POST' })
    return jsonResponse(result)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

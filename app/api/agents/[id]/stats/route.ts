import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const stats = await remoteRequest(`/agents/${id}/stats`)
    return jsonResponse(stats)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

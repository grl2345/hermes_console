import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'

export async function GET() {
  try {
    const stats = await remoteRequest('/dashboard/stats')
    return jsonResponse(stats)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

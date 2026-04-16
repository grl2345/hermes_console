import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { ServerInfo } from '@/lib/types'

export async function GET() {
  try {
    const info = await remoteRequest<ServerInfo>('/server/info')
    return jsonResponse(info)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

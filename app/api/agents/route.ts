import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Agent } from '@/lib/types'

export async function GET() {
  try {
    const agents = await remoteRequest<Agent[]>('/agents')
    return jsonResponse(agents)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const agent = await remoteRequest<Agent>('/agents', {
      method: 'POST',
      body,
    })
    return jsonResponse(agent, 201)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

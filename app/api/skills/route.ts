import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import type { Skill } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const path = agentId ? `/skills?agentId=${agentId}` : '/skills'
    const skills = await remoteRequest<Skill[]>(path)
    return jsonResponse(skills)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const skill = await remoteRequest<Skill>('/skills', {
      method: 'POST',
      body,
    })
    return jsonResponse(skill, 201)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

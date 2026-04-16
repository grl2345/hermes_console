import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('hermes_token')?.value

    if (!token) {
      return errorResponse('未认证', 401)
    }

    const data = await remoteRequest<{ user: any }>('/auth/me', {
      method: 'GET',
    })

    return jsonResponse(data)
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

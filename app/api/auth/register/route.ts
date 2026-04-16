import { remoteRequest, jsonResponse, errorResponse } from '@/lib/api-server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await remoteRequest<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body,
    })

    const cookieStore = await cookies()
    cookieStore.set('hermes_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return jsonResponse({ user: data.user })
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500)
  }
}

import { jsonResponse } from '@/lib/api-server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('hermes_token')
  return jsonResponse({ success: true })
}

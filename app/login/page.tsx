'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const success = await login(email, password)
    
    if (success) {
      router.push('/dashboard')
    } else {
      setError('邮箱或密码错误')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/60 bg-card/90 shadow-sm">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            H
          </div>
          <CardTitle className="text-xl font-semibold">欢迎回来</CardTitle>
          <CardDescription className="text-sm">登录 Hermes Agent 管理平台</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel className="text-sm">邮箱</FieldLabel>
                <Input
                  type="email"
                  placeholder="admin@hermes.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  required
                />
              </Field>
              <Field>
                <FieldLabel className="text-sm">密码</FieldLabel>
                <Input
                  type="password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                  required
                />
              </Field>
            </FieldGroup>
            
            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
            
            <Button type="submit" className="mt-5 h-10 w-full" disabled={isLoading}>
              {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
              登录
            </Button>
          </form>
          
          <p className="mt-5 text-center text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              注册
            </Link>
          </p>
          
          <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">测试账号</p>
            <p className="mt-1 text-muted-foreground">admin@hermes.ai / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

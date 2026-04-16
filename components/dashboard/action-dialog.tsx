'use client'

import { useState } from 'react'
import { agentAction } from '@/hooks/use-agents'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, XCircle, RefreshCw, Power, PowerOff } from 'lucide-react'
import type { Agent } from '@/lib/types'

type ActionType = 'restart' | 'start' | 'stop'

interface ActionDialogProps {
  agent: Agent
  action: ActionType
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const actionConfig = {
  restart: {
    title: '重启 Agent',
    description: '确定要重启该 Agent 吗？正在执行的任务将被中断并重新分配。',
    icon: RefreshCw,
    buttonText: '确认重启',
    buttonClass: '',
    progressText: '正在重启...',
    successText: '重启成功',
  },
  start: {
    title: '启动 Agent',
    description: '确定要启动该 Agent 吗？',
    icon: Power,
    buttonText: '确认启动',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    progressText: '正在启动...',
    successText: '启动成功',
  },
  stop: {
    title: '停止 Agent',
    description: '确定要停止该 Agent 吗？正在执行的任务将被中断。',
    icon: PowerOff,
    buttonText: '确认停止',
    buttonClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
    progressText: '正在停止...',
    successText: '已停止',
  },
}

export function ActionDialog({
  agent,
  action,
  open,
  onOpenChange,
  onSuccess,
}: ActionDialogProps) {
  const [status, setStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const config = actionConfig[action]
  const Icon = config.icon

  const handleAction = async () => {
    setStatus('progress')
    setError('')

    try {
      await agentAction(agent.id, action)
      setStatus('success')
      setTimeout(() => {
        onSuccess?.()
        handleClose()
      }, 1500)
    } catch (err: any) {
      setStatus('error')
      setError(err.message || '操作失败')
    }
  }

  const handleClose = () => {
    setStatus('idle')
    setError('')
    onOpenChange(false)
  }

  const handleRetry = () => {
    setStatus('idle')
    setError('')
    handleAction()
  }

  return (
    <AlertDialog open={open} onOpenChange={status === 'idle' ? onOpenChange : undefined}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${agent.avatarColor}`}>
              {agent.shortName}
            </div>
            <span>{config.title}</span>
          </AlertDialogTitle>

          {status === 'idle' && (
            <AlertDialogDescription className="pt-2">
              {config.description}
              <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium text-foreground">{agent.name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">容器</span>
                  <span className="font-mono text-xs text-foreground">{agent.containerId}</span>
                </div>
              </div>
            </AlertDialogDescription>
          )}

          {status === 'progress' && (
            <div className="pt-6 flex flex-col items-center gap-3">
              <Spinner className="h-10 w-10" />
              <p className="text-lg font-medium text-foreground">{config.progressText}</p>
              <p className="text-sm text-muted-foreground">
                正在向远程服务器发送{action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}指令...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="pt-6 flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-lg font-medium text-foreground">{config.successText}</p>
              <p className="text-sm text-muted-foreground">
                {agent.name} 已{action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}完成
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="pt-6 flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-lg font-medium text-foreground">操作失败</p>
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4">
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleAction} className={config.buttonClass}>
                <Icon className="mr-2 h-4 w-4" />
                {config.buttonText}
              </Button>
            </>
          )}

          {status === 'progress' && (
            <Button disabled>
              <Spinner className="mr-2" />
              {config.progressText}
            </Button>
          )}

          {status === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
              <Button onClick={handleRetry}>
                重试
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

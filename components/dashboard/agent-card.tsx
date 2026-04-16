'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-badge'
import { LogDialog } from './log-dialog'
import { ActionDialog } from './action-dialog'
import { ExternalLink, FileText, RotateCcw, Power, PowerOff } from 'lucide-react'

interface AgentCardProps {
  agent: Agent
  showReportsTo?: boolean
  supervisorName?: string
  onAgentUpdate?: () => void
}

export function AgentCard({ agent, showReportsTo, supervisorName, onAgentUpdate }: AgentCardProps) {
  const isOffline = agent.status === 'offline'
  const isIdle = agent.status === 'online' && !agent.currentTask
  
  const [logOpen, setLogOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<'restart' | 'start' | 'stop'>('restart')
  
  const handleAction = (action: 'restart' | 'start' | 'stop') => {
    setCurrentAction(action)
    setActionOpen(true)
  }
  
  return (
    <>
      <Card className="border-border/60 bg-card/80 transition-all hover:border-border hover:shadow-sm">
        <CardContent className="p-5">
          {/* Header: Avatar + Info + Status */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold ${agent.avatarColor}`}>
                {agent.shortName}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium text-foreground">{agent.name}</h3>
                  {agent.level === 'ceo' && (
                    <span className="shrink-0 text-xs text-muted-foreground">(主控)</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {agent.model} · {agent.level === 'ceo' ? agent.uptime : agent.role}
                </p>
              </div>
            </div>
            <StatusBadge status={agent.status} />
          </div>

          {/* Stats Row */}
          <div className="mt-4 flex items-center gap-5 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">技能</span>
              <span className="font-medium text-foreground">{agent.skillCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">进行中</span>
              <span className="font-medium text-foreground">{agent.activeTaskCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">今日</span>
              <span className="font-medium text-foreground">{agent.todayTaskCount}</span>
            </div>
          </div>

          {/* Current Status Text */}
          <div className="mt-3 min-h-[20px]">
            {isOffline && agent.errorMessage ? (
              <p className="text-sm text-destructive">
                容器 {agent.stoppedAt}停止 · {agent.errorMessage}
              </p>
            ) : isIdle ? (
              <p className="text-sm text-muted-foreground">空闲中 · 等待新任务</p>
            ) : agent.currentTask ? (
              <p className="truncate text-sm text-muted-foreground">
                正在处理 · {agent.currentTask}
              </p>
            ) : null}
          </div>

          {/* Reports To Badge */}
          {showReportsTo && supervisorName && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                汇报给 {supervisorName}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" asChild>
              <Link href={`/dashboard/agents/${agent.id}`}>
                详情 <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-xs"
              onClick={() => setLogOpen(true)}
            >
              <FileText className="mr-1 h-3 w-3" />
              日志
            </Button>
            {isOffline ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                onClick={() => handleAction('start')}
              >
                <Power className="mr-1 h-3 w-3" />
                启动
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs"
                onClick={() => handleAction('restart')}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重启
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <LogDialog 
        agent={agent} 
        open={logOpen} 
        onOpenChange={setLogOpen} 
      />
      <ActionDialog
        agent={agent}
        action={currentAction}
        open={actionOpen}
        onOpenChange={setActionOpen}
        onSuccess={onAgentUpdate}
      />
    </>
  )
}

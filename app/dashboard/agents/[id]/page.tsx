'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAgentById, getTasksByAgentId, getSkillsByAgentId, agents } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { TaskList } from '@/components/dashboard/task-list'
import { SkillList } from '@/components/dashboard/skill-list'
import { LogDialog } from '@/components/dashboard/log-dialog'
import { ActionDialog } from '@/components/dashboard/action-dialog'
import { ChevronRight, FileText, RotateCcw, Power, PowerOff, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const agent = getAgentById(id)
  
  const [logOpen, setLogOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<'restart' | 'start' | 'stop'>('restart')

  if (!agent) {
    notFound()
  }

  const tasks = getTasksByAgentId(id)
  const skills = getSkillsByAgentId(id)
  const supervisor = agent.reportsTo ? agents.find(a => a.id === agent.reportsTo) : null
  const subordinates = agents.filter(a => a.reportsTo === agent.id)
  
  const handleAction = (action: 'restart' | 'start' | 'stop') => {
    setCurrentAction(action)
    setActionOpen(true)
  }

  return (
    <div className="min-h-screen p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">
          Agents
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{agent.name}</span>
      </nav>

      {/* Header */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold ${agent.avatarColor}`}>
            {agent.shortName}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {agent.role} · {agent.model} · 容器 {agent.containerId}
            </p>
            {supervisor && (
              <p className="mt-1 text-xs text-muted-foreground">
                汇报给 <Link href={`/dashboard/agents/${supervisor.id}`} className="text-primary hover:underline">{supervisor.name}</Link>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={() => setLogOpen(true)}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            日志
          </Button>
          {agent.status === 'offline' ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
              onClick={() => handleAction('start')}
            >
              <Power className="mr-1.5 h-4 w-4" />
              启动
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9"
                onClick={() => handleAction('restart')}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                重启
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 text-destructive hover:text-destructive"
                onClick={() => handleAction('stop')}
              >
                <PowerOff className="mr-1.5 h-4 w-4" />
                停止
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>编辑配置</DropdownMenuItem>
              <DropdownMenuItem>查看环境变量</DropdownMenuItem>
              <DropdownMenuItem>导出数据</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">删除 Agent</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Resource Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">CPU</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{agent.cpu}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">内存</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{agent.memory} MB</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">本周 Token</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{Math.round(agent.weeklyTokens / 1000)}K</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">本周成本</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">${agent.weeklyCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subordinates */}
      {subordinates.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-foreground">下属 Agent ({subordinates.length})</h2>
          <div className="flex flex-wrap gap-2">
            {subordinates.map(sub => (
              <Link
                key={sub.id}
                href={`/dashboard/agents/${sub.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm transition-colors hover:border-border hover:bg-card"
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${sub.avatarColor}`}>
                  {sub.shortName}
                </div>
                <span className="font-medium text-foreground">{sub.name}</span>
                <StatusBadge status={sub.status} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Tasks - wider */}
        <div className="lg:col-span-3">
          <Card className="border-border/60 bg-card/80">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">最近任务</CardTitle>
              <Link href="#" className="text-sm text-primary hover:underline">
                全部
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <TaskList tasks={tasks} compact />
            </CardContent>
          </Card>
        </div>

        {/* Skills - narrower */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/80">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">技能 (Skills)</CardTitle>
              <Link href={`/dashboard/skills?agent=${agent.id}`} className="text-sm text-primary hover:underline">
                + 新增
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <SkillList skills={skills} agentId={agent.id} compact />
            </CardContent>
          </Card>
        </div>
      </div>
      
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
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { agents, serverInfo, getDashboardStats } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OrgChart } from '@/components/dashboard/org-chart'
import { AgentCard } from '@/components/dashboard/agent-card'
import { RefreshCw, Plus, MoreHorizontal, LayoutGrid, Network } from 'lucide-react'

type ViewMode = 'grid' | 'org'

export default function DashboardPage() {
  const [lastRefresh, setLastRefresh] = useState(serverInfo.lastUpdated)
  const [viewMode, setViewMode] = useState<ViewMode>('org')
  const stats = getDashboardStats()

  const handleRefresh = () => {
    setLastRefresh(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
  }

  const getAgentName = (id: string) => {
    const agent = agents.find(a => a.id === id)
    return agent?.name || ''
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agent 控制台</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            远程服务器 · {serverInfo.hostname} · 最后更新 {lastRefresh}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
            刷新
          </Button>
          <Button size="sm" className="h-9" asChild>
            <Link href="/dashboard/new-agent">
              <Plus className="mr-1.5 h-4 w-4" />
              新建 Agent
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">在线 Agent</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{stats.onlineCount}</span>
              <span className="text-sm text-muted-foreground">/ {stats.totalAgents}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">进行中任务</p>
            <div className="mt-1">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{stats.activeTaskCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">今日完成</p>
            <div className="mt-1">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{stats.todayCompleted}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">今日 Token</p>
            <div className="mt-1">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{Math.round(stats.todayTokens / 1000)}K</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle + Agent Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Agent 列表</h2>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode('org')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'org' 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              组织架构
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              网格视图
            </button>
          </div>
        </div>

        {/* Agent Views */}
        <div className="mt-4">
          {viewMode === 'org' ? (
            <OrgChart agents={agents} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.map((agent) => (
                <AgentCard 
                  key={agent.id} 
                  agent={agent}
                  showReportsTo={!!agent.reportsTo}
                  supervisorName={agent.reportsTo ? getAgentName(agent.reportsTo) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

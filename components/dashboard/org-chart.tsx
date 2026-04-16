'use client'

import type { Agent } from '@/lib/types'
import { AgentCard } from './agent-card'

interface OrgChartProps {
  agents: Agent[]
}

export function OrgChart({ agents }: OrgChartProps) {
  // 按层级分组
  const ceo = agents.find(a => a.level === 'ceo')
  const directors = agents.filter(a => a.level === 'director')
  const staff = agents.filter(a => a.level === 'staff')

  const getAgentName = (id: string) => {
    const agent = agents.find(a => a.id === id)
    return agent?.name || ''
  }

  return (
    <div className="space-y-6">
      {/* CEO 层级 - 秘书长 */}
      {ceo && (
        <div className="flex flex-col items-center">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            总控
          </div>
          <div className="w-full max-w-md">
            <AgentCard agent={ceo} />
          </div>
          {/* 连接线 */}
          {directors.length > 0 && (
            <div className="mt-4 flex flex-col items-center">
              <div className="h-6 w-px bg-border" />
              <div className="h-px w-full max-w-2xl bg-border" />
            </div>
          )}
        </div>
      )}

      {/* Director 层级 - 各部门 */}
      {directors.length > 0 && (
        <div>
          <div className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            部门
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {directors.map((agent) => (
              <div key={agent.id} className="relative">
                <AgentCard 
                  agent={agent} 
                  showReportsTo={!!agent.reportsTo}
                  supervisorName={agent.reportsTo ? getAgentName(agent.reportsTo) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff 层级 */}
      {staff.length > 0 && (
        <div>
          <div className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            员工
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent}
                showReportsTo={!!agent.reportsTo}
                supervisorName={agent.reportsTo ? getAgentName(agent.reportsTo) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

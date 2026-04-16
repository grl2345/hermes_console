'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/use-agents'
import { Button } from '@/components/ui/button'
import { AgentCard } from '@/components/dashboard/agent-card'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'

export default function AgentsPage() {
  const { data: agents, isLoading, error } = useAgents(10000)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent 列表</h1>
          <p className="text-sm text-muted-foreground">
            共 {agents?.length ?? 0} 个 Agent
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new-agent">
            <Plus className="mr-2 h-4 w-4" />
            新建 Agent
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">{error}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents?.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

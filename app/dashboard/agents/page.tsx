'use client'

import Link from 'next/link'
import { agents } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { AgentCard } from '@/components/dashboard/agent-card'
import { Plus } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent 列表</h1>
          <p className="text-sm text-muted-foreground">
            共 {agents.length} 个 Agent
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new-agent">
            <Plus className="mr-2 h-4 w-4" />
            新建 Agent
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}

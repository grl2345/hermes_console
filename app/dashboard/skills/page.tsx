'use client'

import Link from 'next/link'
import { skills, agents } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default function SkillsPage() {
  const getAgentName = (agentId: string) => {
    return agents.find(a => a.id === agentId)?.name || agentId
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">技能管理</h1>
          <p className="text-sm text-muted-foreground">
            管理所有 Agent 的 SKILL.md 技能定义
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新增技能
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">所有技能</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {skills.map((skill) => (
            <Link
              key={skill.id}
              href={`/dashboard/skills/${skill.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-foreground">
                    {skill.name}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    v{skill.version}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {skill.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getAgentName(skill.agentId)} · {skill.updatedAt}更新
                </p>
              </div>
              <code className="text-xs text-muted-foreground">
                {skill.filePath}
              </code>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

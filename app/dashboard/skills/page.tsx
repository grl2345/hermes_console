'use client'

import Link from 'next/link'
import { useSkills } from '@/hooks/use-skills'
import { useAgents } from '@/hooks/use-agents'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'

export default function SkillsPage() {
  const { data: skills, isLoading: skillsLoading } = useSkills()
  const { data: agents } = useAgents()

  const getAgentName = (agentId: string) => {
    return agents?.find(a => a.id === agentId)?.name || agentId
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
          {skillsLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : skills && skills.length > 0 ? (
            skills.map((skill) => (
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
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无技能</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import Link from 'next/link'
import type { Skill } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SkillListProps {
  skills: Skill[]
  agentId: string
  compact?: boolean
}

export function SkillList({ skills, agentId, compact = false }: SkillListProps) {
  if (skills.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无技能</p>
  }

  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <Link
          key={skill.id}
          href={`/dashboard/skills/${skill.id}`}
          className={cn(
            'block rounded-lg border border-border/60 bg-background/50 transition-colors hover:border-border hover:bg-accent/50',
            compact ? 'p-3' : 'p-4'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn('font-mono font-medium text-foreground', compact && 'text-sm')}>
              {skill.name}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              v{skill.version}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{skill.description}</p>
        </Link>
      ))}
    </div>
  )
}

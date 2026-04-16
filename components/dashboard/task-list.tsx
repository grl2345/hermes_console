'use client'

import type { Task } from '@/lib/types'
import { StatusBadge } from './status-badge'
import { cn } from '@/lib/utils'

interface TaskListProps {
  tasks: Task[]
  compact?: boolean
}

export function TaskList({ tasks, compact = false }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无任务</p>
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={cn(
            'rounded-lg border border-border/60 bg-background/50 transition-colors',
            compact ? 'p-3' : 'p-4'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={task.status} />
                <span className={cn('font-medium text-foreground', compact && 'text-sm')}>
                  {task.name}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {task.source && (
                  <>来自 {task.source}</>
                )}
                {task.startedAt && (
                  <> · {task.startedAt}</>
                )}
                {task.duration && (
                  <> · 已运行 {task.duration}</>
                )}
                {task.tokens && (
                  <> · 用 {(task.tokens / 1000).toFixed(1)}K tokens</>
                )}
              </p>
              {task.error && (
                <p className="mt-1 text-sm text-destructive">
                  {task.error} · <button className="text-primary hover:underline">重试</button>
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

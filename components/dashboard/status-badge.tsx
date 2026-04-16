import { cn } from '@/lib/utils'
import type { AgentStatus, TaskStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: AgentStatus | TaskStatus
  className?: string
  size?: 'sm' | 'default'
}

const statusConfig = {
  // Agent 状态
  online: { label: '在线', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  busy: { label: '忙碌', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  offline: { label: '离线', className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400' },
  // 任务状态
  running: { label: '进行中', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  success: { label: '成功', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  failed: { label: '失败', className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400' },
  pending: { label: '等待中', className: 'bg-muted text-muted-foreground border-border' },
}

export function StatusBadge({ status, className, size = 'default' }: StatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'gap-1 px-1.5 py-0 text-[10px]' : 'gap-1.5 px-2.5 py-0.5 text-xs',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'rounded-full',
          size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5',
          status === 'online' || status === 'running' || status === 'success'
            ? 'bg-emerald-500'
            : status === 'busy'
            ? 'bg-amber-500'
            : status === 'offline' || status === 'failed'
            ? 'bg-red-500'
            : 'bg-slate-400'
        )}
      />
      {config.label}
    </span>
  )
}

'use client'

import { useState } from 'react'
import { scheduledTasks as initialTasks, agents } from '@/lib/mock-data'
import type { ScheduledTask } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, MoreHorizontal, Pencil, Trash2, Play, History } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/dashboard/status-badge'

interface TaskForm {
  name: string
  cron: string
  cronDescription: string
  agentId: string
}

const defaultForm: TaskForm = {
  name: '',
  cron: '0 9 * * *',
  cronDescription: '每天 09:00',
  agentId: '',
}

// 常用 cron 表达式
const cronPresets = [
  { label: '每天 09:00', cron: '0 9 * * *' },
  { label: '每天 18:00', cron: '0 18 * * *' },
  { label: '每小时', cron: '0 * * * *' },
  { label: '每 6 小时', cron: '0 */6 * * *' },
  { label: '每周一 09:00', cron: '0 9 * * 1' },
  { label: '每月 1 号 08:00', cron: '0 8 1 * *' },
]

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>(initialTasks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)
  const [deletingTask, setDeletingTask] = useState<ScheduledTask | null>(null)
  const [form, setForm] = useState<TaskForm>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)

  const toggleTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, enabled: !t.enabled } : t
      )
    )
  }

  const getAgentName = (agentId: string) => {
    return agents.find(a => a.id === agentId)?.name || agentId
  }

  const openCreateDialog = () => {
    setEditingTask(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEditDialog = (task: ScheduledTask) => {
    setEditingTask(task)
    setForm({
      name: task.name,
      cron: task.cron,
      cronDescription: task.cronDescription,
      agentId: task.agentId,
    })
    setDialogOpen(true)
  }

  const openDeleteDialog = (task: ScheduledTask) => {
    setDeletingTask(task)
    setDeleteDialogOpen(true)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    
    if (editingTask) {
      // 更新任务
      setTasks(prev =>
        prev.map(t =>
          t.id === editingTask.id
            ? { ...t, ...form }
            : t
        )
      )
    } else {
      // 创建新任务
      const newTask: ScheduledTask = {
        id: `cron-${Date.now()}`,
        agentId: form.agentId,
        name: form.name,
        cron: form.cron,
        cronDescription: form.cronDescription,
        nextRun: '明日 09:00',
        enabled: true,
      }
      setTasks(prev => [...prev, newTask])
    }
    
    setIsSubmitting(false)
    setDialogOpen(false)
  }

  const handleDelete = async () => {
    if (!deletingTask) return
    await new Promise(resolve => setTimeout(resolve, 500))
    setTasks(prev => prev.filter(t => t.id !== deletingTask.id))
    setDeleteDialogOpen(false)
    setDeletingTask(null)
  }

  const handleRunNow = async (task: ScheduledTask) => {
    setRunningTaskId(task.id)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setRunningTaskId(null)
    // 更新 lastRun
    setTasks(prev =>
      prev.map(t =>
        t.id === task.id
          ? { ...t, lastRun: '刚刚', lastStatus: 'success' as const }
          : t
      )
    )
  }

  const handleCronPreset = (preset: typeof cronPresets[0]) => {
    setForm(prev => ({
      ...prev,
      cron: preset.cron,
      cronDescription: preset.label,
    }))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">定时任务</h1>
          <p className="text-sm text-muted-foreground">
            管理所有 Agent 的 Cron 定时任务
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新增任务
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">任务列表 ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无定时任务，点击上方按钮创建
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/80 p-4 transition-colors hover:border-border"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      task.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{task.name}</span>
                      {!task.enabled && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          已暂停
                        </span>
                      )}
                      {task.lastStatus && (
                        <StatusBadge status={task.lastStatus} size="sm" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {task.cronDescription}
                      {task.nextRun && ` · 下次 ${task.nextRun}`}
                      {task.lastRun && ` · 上次 ${task.lastRun}`}
                      {' · '}
                      <span className="text-primary">{getAgentName(task.agentId)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <code className="hidden rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:block">
                    {task.cron.split(' ').map((part, i) => (
                      <span key={i} className="mx-0.5">
                        {part === '*' ? '*' : part}
                      </span>
                    ))}
                  </code>
                  <Switch
                    checked={task.enabled}
                    onCheckedChange={() => toggleTask(task.id)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleRunNow(task)}
                        disabled={runningTaskId === task.id}
                      >
                        {runningTaskId === task.id ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            执行中...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            立即执行
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(task)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <History className="mr-2 h-4 w-4" />
                        执行历史
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => openDeleteDialog(task)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '新增定时任务'}</DialogTitle>
            <DialogDescription>
              {editingTask ? '修改定时任务的配置' : '创建一个新的定时任务'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel>任务名称</FieldLabel>
              <Input
                placeholder="如：每日流量汇总"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>执行 Agent</FieldLabel>
              <Select
                value={form.agentId}
                onValueChange={(value) => setForm(prev => ({ ...prev, agentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>执行时间</FieldLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {cronPresets.map(preset => (
                  <Button
                    key={preset.cron}
                    variant={form.cron === preset.cron ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleCronPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Cron 表达式"
                value={form.cron}
                onChange={(e) => setForm(prev => ({ ...prev, cron: e.target.value }))}
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel>时间描述</FieldLabel>
              <Input
                placeholder="如：每天 09:00"
                value={form.cronDescription}
                onChange={(e) => setForm(prev => ({ ...prev, cronDescription: e.target.value }))}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!form.name || !form.agentId || !form.cron || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  保存中...
                </>
              ) : (
                editingTask ? '保存修改' : '创建任务'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除定时任务 "{deletingTask?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

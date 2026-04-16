'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, Pause, Play, Trash2 } from 'lucide-react'
import type { Agent } from '@/lib/types'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

// 模拟日志数据
const generateMockLogs = (agentName: string): LogEntry[] => {
  const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug']
  const messages = [
    '接收到新任务请求',
    '正在连接 Redis Streams...',
    '任务路由完成，分派给目标 Agent',
    '执行 GA4 API 查询',
    '成功获取数据，共 1,247 条记录',
    '生成报告中...',
    '报告生成完成，耗时 2.3s',
    '任务完成，通知秘书长',
    '等待新任务...',
    'Token 消耗：2,145',
    '心跳检测正常',
    '内存使用：256MB / 512MB',
    'API 调用限额：45/100',
    '定时任务触发：每日流量汇总',
  ]
  
  const logs: LogEntry[] = []
  const now = new Date()
  
  for (let i = 0; i < 50; i++) {
    const time = new Date(now.getTime() - (50 - i) * 5000)
    logs.push({
      timestamp: time.toLocaleTimeString('zh-CN', { hour12: false }),
      level: levels[Math.floor(Math.random() * levels.length)],
      message: `[${agentName}] ${messages[Math.floor(Math.random() * messages.length)]}`,
    })
  }
  
  return logs
}

interface LogDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogDialog({ agent, open, onOpenChange }: LogDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (open) {
      setLogs(generateMockLogs(agent.name))
    }
  }, [open, agent.name])
  
  // 模拟实时日志
  useEffect(() => {
    if (!open || isPaused || agent.status === 'offline') return
    
    const interval = setInterval(() => {
      const newLog: LogEntry = {
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        level: Math.random() > 0.9 ? 'warn' : Math.random() > 0.95 ? 'error' : 'info',
        message: `[${agent.name}] 处理中... ${Math.random().toString(36).slice(2, 8)}`,
      }
      setLogs(prev => [...prev.slice(-99), newLog])
    }, 2000)
    
    return () => clearInterval(interval)
  }, [open, isPaused, agent.name, agent.status])
  
  // 自动滚动到底部
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isPaused])
  
  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-amber-500'
      case 'debug': return 'text-blue-400'
      default: return 'text-muted-foreground'
    }
  }
  
  const handleDownload = () => {
    const content = logs.map(l => `${l.timestamp} [${l.level.toUpperCase()}] ${l.message}`).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent.containerId}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${agent.avatarColor}`}>
                {agent.shortName}
              </div>
              <div>
                <span className="text-foreground">{agent.name}</span>
                <span className="ml-2 text-sm font-normal text-muted-foreground">容器日志</span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                className="h-8 px-2"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span className="ml-1.5">{isPaused ? '继续' : '暂停'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
                className="h-8 px-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-1.5">清空</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 px-2"
              >
                <Download className="h-4 w-4" />
                <span className="ml-1.5">下载</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="bg-slate-950 p-4 font-mono text-xs leading-relaxed min-h-full">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">暂无日志</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-3 py-0.5 hover:bg-slate-900/50">
                  <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                  <span className={`shrink-0 uppercase w-12 ${getLevelColor(log.level)}`}>
                    [{log.level}]
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="px-4 py-2 border-t border-border/60 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>容器 ID: {agent.containerId}</span>
          <span>{logs.length} 条日志 {isPaused && '(已暂停)'}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

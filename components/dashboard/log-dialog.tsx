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

function parseLogLine(raw: string): LogEntry | null {
  // 尝试解析 JSON 格式日志
  try {
    const parsed = JSON.parse(raw)
    if (parsed.timestamp && parsed.message) {
      return {
        timestamp: parsed.timestamp,
        level: parsed.level || 'info',
        message: parsed.message,
      }
    }
  } catch {}

  // 尝试解析常见文本格式：[TIMESTAMP] [LEVEL] MESSAGE
  const match = raw.match(/^\[?(\d{2}:\d{2}:\d{2})\]?\s*\[?(info|warn|error|debug)\]?\s*(.+)/i)
  if (match) {
    return {
      timestamp: match[1],
      level: match[2].toLowerCase() as LogEntry['level'],
      message: match[3],
    }
  }

  // 无法解析时作为 info 原样输出
  if (raw.trim()) {
    return {
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level: 'info',
      message: raw.trim(),
    }
  }

  return null
}

interface LogDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogDialog({ agent, open, onOpenChange }: LogDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // 建立 SSE 日志连接
  useEffect(() => {
    if (!open || isPaused) {
      // 暂停或关闭时断开连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsConnected(false)
      }
      return
    }

    const es = new EventSource(`/api/agents/${agent.id}/logs`)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
    }

    es.onmessage = (event) => {
      const entry = parseLogLine(event.data)
      if (entry) {
        setLogs(prev => [...prev.slice(-499), entry])
      }
    }

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      eventSourceRef.current = null
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [open, isPaused, agent.id])

  // 关闭时清空
  useEffect(() => {
    if (!open) {
      setLogs([])
      setIsPaused(false)
    }
  }, [open])

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
                {isConnected && (
                  <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                )}
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
              <div className="text-slate-500 text-center py-8">
                {isConnected ? '等待日志...' : '正在连接...'}
              </div>
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
          <span>{logs.length} 条日志 {isPaused && '(已暂停)'} {!isConnected && !isPaused && '(未连接)'}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

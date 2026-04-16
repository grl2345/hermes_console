'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSkillById, agents } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, History, ExternalLink } from 'lucide-react'

// 简单的 Markdown 渲染函数
function renderMarkdown(content: string): string {
  return content
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-semibold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-semibold mt-5 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-semibold mt-5 mb-3 text-foreground">$1</h1>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-medium">$1</strong>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 text-sm text-muted-foreground">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2 text-sm text-muted-foreground">')
    .replace(/\n/g, '<br/>')
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (match) {
    const frontmatter = match[1]
    const body = match[2]
    const meta: Record<string, string> = {}
    frontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length) {
        meta[key.trim()] = valueParts.join(':').trim()
      }
    })
    return { meta, body }
  }
  return { meta: {}, body: content }
}

export default function SkillEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const skill = getSkillById(id)

  if (!skill) {
    notFound()
  }

  const agent = agents.find(a => a.id === skill.agentId)
  const [content, setContent] = useState(skill.content)
  const [hasChanges, setHasChanges] = useState(false)

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setHasChanges(e.target.value !== skill.content)
  }

  const { meta, body } = useMemo(() => parseFrontmatter(content), [content])
  const renderedHtml = useMemo(() => renderMarkdown(body), [body])

  const handleSave = () => {
    alert('保存成功！平台将通过 docker exec 把新的 SKILL.md 写入容器，并发送 SIGHUP 触发热加载。')
    setHasChanges(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 p-5">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Agents</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/dashboard/agents/${skill.agentId}`} className="hover:text-foreground">{agent?.name}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">技能 · {skill.name}</span>
        </nav>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">{skill.name}.md</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              v{skill.version} · {skill.updatedAt}更新 · 容器路径 {skill.filePath}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasChanges && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                有未保存改动
              </span>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <History className="mr-1.5 h-3.5 w-3.5" />
              历史 <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => {
                setContent(skill.content)
                setHasChanges(false)
              }}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              保存并热更新 <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-h-0 flex-1">
        {/* Markdown Editor */}
        <div className="flex w-1/2 flex-col border-r border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium text-foreground">编辑</span>
            <span className="text-xs text-muted-foreground">markdown</span>
          </div>
          <textarea
            value={content}
            onChange={handleContentChange}
            className="flex-1 resize-none bg-background p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            spellCheck={false}
            placeholder="在此编辑 SKILL.md..."
          />
        </div>

        {/* Preview */}
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium text-foreground">预览</span>
            <span className="text-xs text-muted-foreground">rendered</span>
          </div>
          <div className="flex-1 overflow-auto bg-background p-4">
            {/* Frontmatter Preview */}
            {Object.keys(meta).length > 0 && (
              <Card className="mb-4 border-border/60 bg-muted/30">
                <CardContent className="p-3 font-mono text-sm leading-relaxed">
                  {Object.entries(meta).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      <span className="text-foreground">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {/* Body Preview */}
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="border-t border-amber-500/20 bg-amber-500/5 px-5 py-3 text-sm text-amber-700 dark:text-amber-300">
        <span className="font-medium">保存后会发生什么：</span> 平台通过 docker exec 把新的 SKILL.md 写入{' '}
        <code className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs text-amber-600 dark:text-amber-400">{agent?.containerId}</code>{' '}
        容器，并向容器发送 SIGHUP 触发热加载。整个过程约 2-3 秒，当前正在执行的任务不受影响。
      </div>
    </div>
  )
}

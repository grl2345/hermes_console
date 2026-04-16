'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createAgent } from '@/hooks/use-agents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ChevronLeft, ChevronRight, Check, CheckCircle, Rocket } from 'lucide-react'

const STEPS = [
  { id: 1, title: '基本信息', description: '设置 Agent 名称和角色' },
  { id: 2, title: '模型配置', description: '选择 AI 模型和参数' },
  { id: 3, title: '技能初始化', description: '添加初始技能' },
  { id: 4, title: '确认创建', description: '检查并创建 Agent' },
]

const MODELS = [
  { id: 'kimi-k2.5', name: 'Kimi-K2.5', description: '推荐，综合能力强' },
  { id: 'gpt-4', name: 'GPT-4', description: '高级推理能力' },
  { id: 'claude-3', name: 'Claude 3', description: '长文本处理' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', description: '性价比高' },
]

const SKILL_TEMPLATES = [
  { id: 'ga-query', name: 'Google Analytics 查询', description: '查询 GA4 数据指标' },
  { id: 'reddit-crawler', name: 'Reddit 爬虫', description: '抓取 Reddit 热门帖子' },
  { id: 'github-monitor', name: 'GitHub 监控', description: '监控仓库动态' },
  { id: 'email-sender', name: '邮件发送', description: '发送自动化邮件' },
  { id: 'custom', name: '自定义技能', description: '从空白开始创建' },
]

interface FormData {
  name: string
  shortName: string
  role: string
  model: string
  skills: string[]
}

export default function NewAgentPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    shortName: '',
    role: '',
    model: 'kimi-k2.5',
    skills: [],
  })

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const toggleSkill = (skillId: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(s => s !== skillId)
        : [...prev.skills, skillId],
    }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.shortName && formData.role
      case 2:
        return formData.model
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  }

  const [createSuccess, setCreateSuccess] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    setCreateError(null)
    try {
      await createAgent(formData)
      setIsCreating(false)
      setCreateSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setIsCreating(false)
      setCreateError(err.message || '创建失败')
    }
  }

  // 创建成功界面
  if (createSuccess) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Agent 创建成功
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{formData.name}</span> 已成功部署到远程服务器
            </p>
            <div className="mb-6 rounded-lg bg-muted/50 p-4 text-left text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Rocket className="h-4 w-4" />
                <span>容器正在启动中...</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>- 容器 ID: {formData.shortName.toLowerCase()}-agent-g01</p>
                <p>- 模型: {MODELS.find(m => m.id === formData.model)?.name}</p>
                <p>- 技能: {formData.skills.length} 个</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              正在跳转到控制台...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          返回控制台
        </Link>
        <h1 className="text-2xl font-bold text-foreground">新建 Agent</h1>
        <p className="text-sm text-muted-foreground">
          通过向导创建新的 Agent 并部署到服务器
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    currentStep > step.id
                      ? 'bg-emerald-500 text-white'
                      : currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-4 h-0.5 w-16 ${
                    currentStep > step.id ? 'bg-emerald-500' : 'bg-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <FieldGroup>
              <Field>
                <FieldLabel>Agent 名称</FieldLabel>
                <Input
                  placeholder="如：财务部、数据分析师"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>简称（单字）</FieldLabel>
                <Input
                  placeholder="如：财、数"
                  maxLength={1}
                  value={formData.shortName}
                  onChange={(e) => updateFormData({ shortName: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>角色描述</FieldLabel>
                <Input
                  placeholder="如：Google Analytics、Reddit 研究"
                  value={formData.role}
                  onChange={(e) => updateFormData({ role: e.target.value })}
                />
              </Field>
            </FieldGroup>
          )}

          {/* Step 2: Model Selection */}
          {currentStep === 2 && (
            <div className="space-y-3">
              {MODELS.map((model) => (
                <div
                  key={model.id}
                  onClick={() => updateFormData({ model: model.id })}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                    formData.model === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{model.name}</p>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                    </div>
                    {formData.model === model.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">选择要为此 Agent 添加的初始技能（可选）</p>
              {SKILL_TEMPLATES.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                    formData.skills.includes(skill.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{skill.name}</p>
                      <p className="text-sm text-muted-foreground">{skill.description}</p>
                    </div>
                    {formData.skills.includes(skill.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h3 className="mb-3 font-medium text-foreground">确认信息</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">名称</dt>
                    <dd className="font-medium text-foreground">{formData.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">简称</dt>
                    <dd className="font-medium text-foreground">{formData.shortName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">角色</dt>
                    <dd className="font-medium text-foreground">{formData.role}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">模型</dt>
                    <dd className="font-medium text-foreground">
                      {MODELS.find(m => m.id === formData.model)?.name}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">技能数量</dt>
                    <dd className="font-medium text-foreground">{formData.skills.length} 个</dd>
                  </div>
                </dl>
              </div>
              {createError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  {createError}
                </div>
              )}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                <strong>创建后将执行：</strong>
                <ul className="mt-2 list-inside list-disc space-y-1 text-amber-600 dark:text-amber-400">
                  <li>在远程服务器 docker-host-01 上创建容器</li>
                  <li>自动注入环境变量和 Redis 连接配置</li>
                  <li>初始化技能目录并挂载</li>
                  <li>启动 Agent 并注册到秘书长</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一步
            </Button>
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
              >
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Spinner className="mr-2" />
                    创建中...
                  </>
                ) : (
                  '创建 Agent'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

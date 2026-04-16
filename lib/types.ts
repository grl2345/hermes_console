// Agent 状态类型
export type AgentStatus = 'online' | 'busy' | 'offline'

// Agent 基础信息
export interface Agent {
  id: string
  name: string
  shortName: string // 单字简称
  role: string // 角色描述
  model: string // 使用的模型
  containerId: string // Docker 容器 ID
  status: AgentStatus
  uptime: string // 运行时长
  skillCount: number
  activeTaskCount: number
  todayTaskCount: number
  currentTask?: string // 当前正在处理的任务
  cpu: number
  memory: number // MB
  weeklyTokens: number
  weeklyCost: number
  // 汇报层级关系
  reportsTo?: string // 上级 Agent ID
  level: 'ceo' | 'director' | 'staff' // 层级：CEO/总监/员工
  avatarColor: string // 头像背景色
  errorMessage?: string // 错误信息
  stoppedAt?: string // 停止时间
}

// 任务状态
export type TaskStatus = 'running' | 'success' | 'failed' | 'pending'

// 任务信息
export interface Task {
  id: string
  agentId: string
  name: string
  status: TaskStatus
  source: string // 来源：秘书长/定时任务
  startedAt: string
  duration?: string
  tokens?: number
  error?: string
}

// 定时任务
export interface ScheduledTask {
  id: string
  agentId: string
  name: string
  cron: string
  cronDescription: string
  nextRun?: string
  enabled: boolean
  lastRun?: string
  lastStatus?: TaskStatus
}

// 技能定义
export interface Skill {
  id: string
  agentId: string
  name: string
  version: number
  description: string
  content: string // Markdown 内容
  updatedAt: string
  filePath: string // 容器内路径
}

// 用户
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
}

// 服务器信息
export interface ServerInfo {
  hostname: string
  lastUpdated: string
}

import type { Agent, Task, ScheduledTask, Skill, ServerInfo } from './types'

export const serverInfo: ServerInfo = {
  hostname: 'docker-host-01',
  lastUpdated: '14:52',
}

export const agents: Agent[] = [
  {
    id: 'secretary',
    name: '秘书长',
    shortName: '秘',
    role: '主控',
    model: 'Kimi-K2.5',
    containerId: 'secretary-g01',
    status: 'online',
    uptime: '7 天运行',
    skillCount: 5,
    activeTaskCount: 2,
    todayTaskCount: 18,
    currentTask: '将"竞品分析"分派给市场部',
    cpu: 15,
    memory: 256,
    weeklyTokens: 520000,
    weeklyCost: 8.45,
    reportsTo: undefined, // CEO 无上级
    level: 'ceo',
    avatarColor: 'bg-primary/15 text-primary',
  },
  {
    id: 'data',
    name: '数据部',
    shortName: '数',
    role: 'Google Analytics',
    model: 'Kimi-K2.5',
    containerId: 'data-agent-g01',
    status: 'busy',
    uptime: '5 天运行',
    skillCount: 3,
    activeTaskCount: 3,
    todayTaskCount: 12,
    currentTask: '拉取 Q1 广告渠道数据',
    cpu: 23,
    memory: 412,
    weeklyTokens: 284000,
    weeklyCost: 4.12,
    reportsTo: 'secretary',
    level: 'director',
    avatarColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'market',
    name: '市场部',
    shortName: '市',
    role: 'Reddit 研究',
    model: 'Kimi-K2.5',
    containerId: 'market-agent-g01',
    status: 'online',
    uptime: '3 天运行',
    skillCount: 4,
    activeTaskCount: 1,
    todayTaskCount: 8,
    currentTask: undefined,
    cpu: 8,
    memory: 198,
    weeklyTokens: 156000,
    weeklyCost: 2.35,
    reportsTo: 'secretary',
    level: 'director',
    avatarColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  {
    id: 'dev',
    name: '研发部',
    shortName: '研',
    role: 'GitHub',
    model: 'Kimi-K2.5',
    containerId: 'dev-agent-g01',
    status: 'offline',
    uptime: '',
    skillCount: 2,
    activeTaskCount: 0,
    todayTaskCount: 4,
    currentTask: undefined,
    cpu: 0,
    memory: 0,
    weeklyTokens: 89000,
    weeklyCost: 1.28,
    reportsTo: 'secretary',
    level: 'director',
    avatarColor: 'bg-muted text-muted-foreground',
    errorMessage: 'Exit 137 OOM',
    stoppedAt: '12 分钟前',
  },
]

export const tasks: Task[] = [
  {
    id: 'task-1',
    agentId: 'data',
    name: '拉取 Q1 广告渠道 ROI 数据',
    status: 'running',
    source: '秘书长',
    startedAt: '2 分钟前启动',
    duration: '1m 47s',
  },
  {
    id: 'task-2',
    agentId: 'data',
    name: '生成 3 月用户留存报告',
    status: 'running',
    source: '定时任务',
    startedAt: '14:00 启动',
    duration: '52 分钟',
  },
  {
    id: 'task-3',
    agentId: 'data',
    name: '查询"落地页 A 的跳出率"',
    status: 'success',
    source: '秘书长',
    startedAt: '',
    duration: '18s',
    tokens: 2100,
  },
  {
    id: 'task-4',
    agentId: 'data',
    name: '导出竞品关键词搜索量',
    status: 'failed',
    source: '',
    startedAt: '',
    error: 'GA API 401 权限过期',
  },
  {
    id: 'task-5',
    agentId: 'data',
    name: '汇总上周流量来源 Top 10',
    status: 'success',
    source: '定时任务',
    startedAt: '今日 09:00',
    duration: '42s',
  },
  {
    id: 'task-6',
    agentId: 'secretary',
    name: '分派"竞品分析"任务给市场部',
    status: 'running',
    source: '用户指令',
    startedAt: '刚刚',
    duration: '12s',
  },
  {
    id: 'task-7',
    agentId: 'market',
    name: '收集 Reddit 热门帖子',
    status: 'running',
    source: '秘书长',
    startedAt: '5 分钟前',
    duration: '5m 12s',
  },
]

export const scheduledTasks: ScheduledTask[] = [
  {
    id: 'cron-1',
    agentId: 'data',
    name: '每日流量汇总',
    cron: '0 9 * * *',
    cronDescription: '每天 09:00',
    nextRun: '明日 09:00',
    enabled: true,
    lastRun: '今日 09:00',
    lastStatus: 'success',
  },
  {
    id: 'cron-2',
    agentId: 'data',
    name: '月度留存报告',
    cron: '0 8 1 * *',
    cronDescription: '每月 1 号 08:00',
    nextRun: '下月 1 号 08:00',
    enabled: false,
    lastRun: '上月 1 号 08:00',
    lastStatus: 'success',
  },
  {
    id: 'cron-3',
    agentId: 'secretary',
    name: '每日任务汇报',
    cron: '0 18 * * *',
    cronDescription: '每天 18:00',
    nextRun: '今日 18:00',
    enabled: true,
    lastRun: '昨日 18:00',
    lastStatus: 'success',
  },
  {
    id: 'cron-4',
    agentId: 'market',
    name: 'Reddit 热帖抓取',
    cron: '0 */6 * * *',
    cronDescription: '每 6 小时',
    nextRun: '今日 18:00',
    enabled: true,
    lastRun: '今日 12:00',
    lastStatus: 'success',
  },
]

export const skills: Skill[] = [
  {
    id: 'skill-1',
    agentId: 'data',
    name: 'ga-query-runner',
    version: 3,
    description: '查询 GA4 指标：PV、UV、跳出率、转化路径',
    content: `---
name: ga-query-runner
description: 在用户问及任何 Google Analytics 指标（PV、UV、跳出率、转化、留存、流量来源、落地页表现等）时触发。支持按时间范围、维度（国家/设备/渠道）过滤。
version: 3
---

# Google Analytics 查询助手

## 什么时候用我
- 用户问到任何 GA4 指标
- 用户要求生成流量报告
- 秘书长分派"数据查询"类任务

## 认证
凭证通过环境变量 \`GA_CREDENTIALS_JSON\` 注入，启动时自动加载。

## 支持的查询
- 页面浏览量 (PV)
- 独立访客 (UV)
- 跳出率
- 平均会话时长
- 转化率
- 流量来源分布

## 输出格式
返回 JSON 格式数据，包含请求的指标和时间范围。
`,
    updatedAt: '3 天前',
    filePath: '/skills/ga-query-runner/SKILL.md',
  },
  {
    id: 'skill-2',
    agentId: 'data',
    name: 'retention-reporter',
    version: 1,
    description: '生成周/月留存报告，含同比环比',
    content: `---
name: retention-reporter
description: 生成用户留存报告，支持周报和月报，包含同比环比分析。
version: 1
---

# 留存报告生成器

## 功能
- 生成周度留存报告
- 生成月度留存报告
- 计算同比增长
- 计算环比变化

## 触发条件
- 用户询问留存数据
- 定时任务触发
`,
    updatedAt: '1 周前',
    filePath: '/skills/retention-reporter/SKILL.md',
  },
  {
    id: 'skill-3',
    agentId: 'data',
    name: 'funnel-analyzer',
    version: 2,
    description: '多步转化漏斗分析，定位流失环节',
    content: `---
name: funnel-analyzer
description: 分析多步转化漏斗，识别流失环节并提供优化建议。
version: 2
---

# 漏斗分析器

## 功能
- 定义自定义漏斗步骤
- 计算各步骤转化率
- 识别最大流失环节
- 生成优化建议

## 使用方法
指定漏斗步骤和时间范围即可。
`,
    updatedAt: '5 天前',
    filePath: '/skills/funnel-analyzer/SKILL.md',
  },
  {
    id: 'skill-4',
    agentId: 'secretary',
    name: 'task-router',
    version: 2,
    description: '智能分析任务并路由到合适的 Agent',
    content: `---
name: task-router
description: 分析用户请求，识别任务类型，路由到最合适的专业 Agent。
version: 2
---

# 任务路由器

## 路由规则
- 数据相关 -> 数据部
- 市场研究 -> 市场部
- 代码开发 -> 研发部
`,
    updatedAt: '2 天前',
    filePath: '/skills/task-router/SKILL.md',
  },
  {
    id: 'skill-5',
    agentId: 'market',
    name: 'reddit-crawler',
    version: 1,
    description: '抓取 Reddit 指定 subreddit 的热门帖子',
    content: `---
name: reddit-crawler
description: 定期抓取指定 subreddit 的热门帖子，提取关键信息。
version: 1
---

# Reddit 爬虫

## 功能
- 抓取热门帖子
- 提取标题、评分、评论数
- 支持多个 subreddit
`,
    updatedAt: '4 天前',
    filePath: '/skills/reddit-crawler/SKILL.md',
  },
]

// 获取 Agent 相关数据的辅助函���
export function getAgentById(id: string): Agent | undefined {
  return agents.find(a => a.id === id)
}

export function getTasksByAgentId(agentId: string): Task[] {
  return tasks.filter(t => t.agentId === agentId)
}

export function getScheduledTasksByAgentId(agentId: string): ScheduledTask[] {
  return scheduledTasks.filter(t => t.agentId === agentId)
}

export function getSkillsByAgentId(agentId: string): Skill[] {
  return skills.filter(s => s.agentId === agentId)
}

export function getSkillById(id: string): Skill | undefined {
  return skills.find(s => s.id === id)
}

// 统计数据
export function getDashboardStats() {
  const onlineCount = agents.filter(a => a.status !== 'offline').length
  const totalAgents = agents.length
  const activeTaskCount = tasks.filter(t => t.status === 'running').length
  const todayCompleted = agents.reduce((sum, a) => sum + a.todayTaskCount, 0)
  const todayTokens = agents.reduce((sum, a) => sum + Math.round(a.weeklyTokens / 7), 0)
  
  return {
    onlineCount,
    totalAgents,
    activeTaskCount,
    todayCompleted,
    todayTokens,
  }
}

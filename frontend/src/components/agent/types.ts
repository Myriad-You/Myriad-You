/**
 * AraelPanel 组件类型定义
 *
 * 与 AraelPanel.tsx 源文件保持一致
 */

// ============ 动画常量（与源文件一致）============

export const SPRING_SNAPPY = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
} as const
export const SPRING_SMOOTH = {
  type: 'spring',
  stiffness: 350,
  damping: 28,
} as const
export const TRANSITION_QUICK = { duration: 0.12 } as const
export const TRANSITION_NORMAL = { duration: 0.15 } as const
export const TRANSITION_SLOW = { duration: 0.25, ease: 'easeOut' } as const

// ============ 常量 ============

/** 长按触发时间 (ms) */
export const LONG_PRESS_DURATION = 500

// ============ 类型定义（与源文件一致）============

/** 面板可见性状态 */
export type PanelVisibility = 'hidden' | 'visible'

/** 执行步骤 */
export interface ExecutionStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message?: string
  /** 步骤序号（0-based） */
  stepIndex?: number
  /** 总步骤数 */
  totalSteps?: number
  /** 能力分类（用于角色图标） */
  capabilityCategory?: string
  /** 使用的模型层级（仅在执行详情中展示） */
  tierUsed?: 'pro' | 'standard'
  /** 是否降级执行 */
  degraded?: boolean
  /** 步骤耗时 ms */
  durationMs?: number
  /** 重试次数 */
  retryAttempt?: number
  /** 图片生成结果 URL */
  imageUrl?: string
}

/** 日志条目 */
export interface LogEntry {
  id: string
  timestamp: Date
  type: 'info' | 'success' | 'warning' | 'error' | 'debug'
  message: string
  data?: unknown
}

/** 待回答问题 */
export interface PendingQuestion {
  questionId: string
  /** 敏感操作确认 ID；存在时提交到 /agent/confirm */
  confirmationId?: string
  questionType: string
  question: string
  context?: string
  options?: Array<{ value: string; label: string; description?: string }>
  required?: boolean
  defaultValue?: string
  /** 敏感确认：风险等级（BE riskLevel） */
  riskLevel?: string
  /** 敏感确认：服务端给出的有效期（秒） */
  expiresInSeconds?: number
  /** 客户端收到确认时的 epoch ms，用于倒计时 */
  receivedAtMs?: number
}

/** 执行追踪汇总 */
export interface ExecutionTrace {
  totalDurationMs: number
  tierUsage: Record<string, number>
  steps: Array<{
    stepId: string
    capabilityId: string
    tierUsed: string
    durationMs: number
    success: boolean
    error?: string
    action?: string
    params?: Record<string, unknown>
    outputPreview?: string
    isDynamic?: boolean
  }>
  /** Planner 决策（持久化数据） */
  plannerDecision?: {
    status: string
    reasoning?: string
    confidence: number
    plannedSteps: Array<{
      id: string
      capabilityId: string
      action: string
      params?: Record<string, unknown>
    }>
  }
}

/** 多 Agent 协作分配信息 */
export interface MultiAgentAssignment {
  agents: Array<{
    role: string
    displayName: string
    icon: string
    tier: string
    capabilities: string[]
  }>
  totalAgents: number
  isMultiAgent: boolean
  tierMix: string
}

/** 数据展示提示 */
export interface DataDisplayHint {
  type: string
  [key: string]: unknown
}

// ============ 对话系统类型 ============

/** 聊天消息 — 核心状态单元 */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
  /** assistant 消息的任务执行可视化 */
  taskExecution?: TaskExecution
  suggestions?: string[]
  pendingQuestion?: PendingQuestion
  /** 用户已选中的回答（选项 value），用于冻结选项 UI */
  selectedAnswer?: string
  dataDisplay?: DataDisplayHint
  data?: unknown
  /** 图片生成结果 URL（支持多张） */
  imageUrls?: string[]
}

/** 嵌入式任务执行状态 */
export interface TaskExecution {
  taskId: string
  /** 后端 run id；用于断线/刷新后 re-subscribe，不重新 POST 创建任务 */
  runId?: string
  status: 'processing' | 'waiting' | 'cancelling' | 'completed' | 'error'
  progress: number
  steps: ExecutionStep[]
  executionTrace?: ExecutionTrace
  recalledMemories?: string[]
  skillId?: string
  skillName?: string
  assignment?: MultiAgentAssignment
  /** 队列位置 */
  queuePosition?: number
  /** 过程状态文本（进度描述、步骤摘要等） */
  statusMessage?: string
  /** 计划阶段的步骤描述列表（TaskCreated 时设置） */
  planStepDescriptions?: string[]
  /** 调试追踪数据（实时收集的 SSE 调试事件） */
  debugTrace?: DebugTrace
}

/** 实时调试追踪数据（从 SSE 事件中收集） */
export interface DebugTrace {
  /** Planner 决策信息 */
  plannerDecision?: {
    status: string
    reasoning?: string
    confidence: number
    steps: Array<{
      id: string
      capabilityId: string
      action: string
      params?: Record<string, unknown>
    }>
    userRequest: string
  }
  /** 各步骤调试信息（按 stepId 索引） */
  stepDebugEntries: StepDebugEntry[]
}

/** 单个步骤的调试信息（合并 start + complete 阶段） */
export interface StepDebugEntry {
  stepId: string
  capabilityId: string
  isDynamic: boolean
  /** 主 Agent 给此步骤的指令 */
  directive?: string
  /** 用户原始请求 */
  userRequest?: string
  /** 解析后的参数 */
  params?: Record<string, unknown>
  /** 执行输出预览 */
  outputPreview?: string
  /** 耗时 ms */
  durationMs?: number
  /** 是否成功 */
  success?: boolean
  /** 错误信息 */
  error?: string
}

/** 会话 */
export interface ChatSession {
  id: string
  title: string | null
  messageCount: number
  lastActiveAt: string
  createdAt?: string
}

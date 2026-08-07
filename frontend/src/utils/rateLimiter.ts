/**
 * 客户端请求限流工具
 * 防止短时间内大量请求导致的性能问题
 */

interface RateLimitConfig {
  maxRequests: number // 时间窗口内最大请求数
  windowMs: number // 时间窗口（毫秒）
}

interface RateLimitEntry {
  timestamps: number[]
  blocked: boolean
  blockedUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * 默认限流配置
 */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 5 * 60 * 1000 }, // 登录: 5次/5分钟
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // API: 100次/分钟
  fetch: { maxRequests: 10, windowMs: 60 * 1000 }, // 数据获取: 10次/分钟
  analysis: { maxRequests: 5, windowMs: 60 * 1000 }, // 分析: 5次/分钟
}

/** store 容量上限，超过时先回收不再影响判定的条目 */
const MAX_TRACKED_KEYS = 200

/** 所有窗口中最长的一个：超过它仍无活动的条目一定不影响任何判定 */
const MAX_WINDOW_MS = Math.max(
  ...Object.values(DEFAULT_CONFIGS).map((c) => c.windowMs),
)

function lastSeenAt(entry: RateLimitEntry): number {
  return entry.timestamps.length > 0
    ? entry.timestamps[entry.timestamps.length - 1]
    : 0
}

/** 封禁期内的条目不可回收——删掉等于放行一个正被限流的调用方 */
function isBlocked(entry: RateLimitEntry, now: number): boolean {
  return !!(entry.blocked && entry.blockedUntil && now < entry.blockedUntil)
}

/**
 * 回收过期条目，维持 store 容量。
 *
 * key 来自请求 URL：现在只有 lib/api.ts 拦截器写入，基数是几十个固定路径，
 * 但这个上界是调用方的巧合而非本模块的保证——新增一个带 id 的写接口就会
 * 让它无界增长。这里自己兜住。
 */
function pruneRateLimitStore(now: number): void {
  for (const [key, entry] of rateLimitStore) {
    if (isBlocked(entry, now)) continue
    if (now - lastSeenAt(entry) > MAX_WINDOW_MS) {
      rateLimitStore.delete(key)
    }
  }

  if (rateLimitStore.size <= MAX_TRACKED_KEYS) return

  // 仍然超限说明活跃 key 确实多：按最后活动时间淘汰最旧的（同样跳过封禁中的）
  const evictable = [...rateLimitStore.entries()]
    .filter(([, entry]) => !isBlocked(entry, now))
    .sort(([, a], [, b]) => lastSeenAt(a) - lastSeenAt(b))

  const overflow = rateLimitStore.size - MAX_TRACKED_KEYS
  for (const [key] of evictable.slice(0, overflow)) {
    rateLimitStore.delete(key)
  }
}

/**
 * 检查是否超出限流
 */
export function checkRateLimit(
  key: string,
  configName: keyof typeof DEFAULT_CONFIGS = 'api',
): boolean {
  const config = DEFAULT_CONFIGS[configName]
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  if (!entry) {
    // 只在新增 key 时清理，把遍历开销摊到新 key 上而不是每次请求
    if (rateLimitStore.size >= MAX_TRACKED_KEYS) {
      pruneRateLimitStore(now)
    }
    entry = { timestamps: [], blocked: false }
    rateLimitStore.set(key, entry)
  }

  // 检查是否在封禁期
  if (entry.blocked && entry.blockedUntil) {
    if (now < entry.blockedUntil) {
      return false // 仍在封禁期
    } else {
      // 封禁期结束，重置
      entry.blocked = false
      entry.blockedUntil = undefined
      entry.timestamps = []
    }
  }

  // 清理过期的时间戳
  entry.timestamps = entry.timestamps.filter(
    (timestamp) => now - timestamp < config.windowMs,
  )

  // 检查是否超出限制
  if (entry.timestamps.length >= config.maxRequests) {
    // 超出限制，封禁一段时间
    entry.blocked = true
    entry.blockedUntil = now + config.windowMs
    return false
  }

  // 记录本次请求
  entry.timestamps.push(now)
  return true
}

/**
 * Rate Limit 错误类
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public remaining: number = 0,
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

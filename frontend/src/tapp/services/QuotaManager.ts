/**
 * Tapp 配额管理服务
 * 管理 Tapp 的 API 调用配额和使用统计
 *
 * 安全特性：
 * - 滑动窗口速率限制，防止突发请求
 * - 配额数据使用内存缓存，页面刷新后会重置
 * - 只用于快速失败和减少误操作；安全限制必须由后端实现
 *
 * 性能特性：
 * - 高效的滑动窗口算法
 * - 自动清理过期记录
 */

/** 默认配额配置 */
const DEFAULT_QUOTA = {
  platform: {
    readPerMinute: 60, // 每分钟读取次数
    writePerMinute: 10, // 每分钟写入次数
  },
  apiExecutePerMinute: 30,
}

type QuotaConfig = typeof DEFAULT_QUOTA

/** 滑动窗口速率限制器 */
class SlidingWindowRateLimiter {
  private timestamps: number[] = []
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  /**
   * 检查是否允许请求
   * @returns 是否允许，以及剩余配额
   */
  check(): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now()
    this.cleanup(now)

    if (this.timestamps.length >= this.maxRequests) {
      // 计算需要等待的时间
      const oldestTimestamp = this.timestamps[0]
      const retryAfter = Math.max(0, oldestTimestamp + this.windowMs - now)
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      }
    }

    return {
      allowed: true,
      remaining: this.maxRequests - this.timestamps.length - 1,
    }
  }

  /**
   * 记录一次请求
   */
  record(): void {
    this.timestamps.push(Date.now())
  }

  /**
   * 清理过期的时间戳
   */
  private cleanup(now: number): void {
    const cutoff = now - this.windowMs
    // 使用二分查找优化清理
    let left = 0
    let right = this.timestamps.length
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (this.timestamps[mid] <= cutoff) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    if (left > 0) {
      this.timestamps = this.timestamps.slice(left)
    }
  }
}

/** 使用记录 */
interface UsageRecord {
  lastUsedAt: number
  rateLimiter: SlidingWindowRateLimiter
}

/** 配额管理器 */
class TappQuotaManager {
  private readonly quotaConfig: QuotaConfig
  private usageByTapp: Map<string, Record<string, UsageRecord>>

  constructor() {
    this.quotaConfig = { ...DEFAULT_QUOTA }
    this.usageByTapp = new Map()

    // 启动自动清理（每 5 分钟清理一次过期数据）
    setInterval(() => this.cleanupExpiredRecords(), 5 * 60 * 1000)
  }

  /**
   * 清理过期记录
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now()
    const ONE_DAY = 24 * 60 * 60 * 1000

    for (const [tappId, usage] of this.usageByTapp) {
      for (const [type, record] of Object.entries(usage)) {
        // 清理超过一天没有活动的记录
        if (now - record.lastUsedAt > ONE_DAY) {
          delete usage[type]
        }
      }
      // 如果 Tapp 没有任何使用记录，删除它
      if (Object.keys(usage).length === 0) {
        this.usageByTapp.delete(tappId)
      }
    }
  }

  /** 获取或创建 Tapp 的使用记录 */
  private getUsage(tappId: string): Record<string, UsageRecord> {
    if (!this.usageByTapp.has(tappId)) {
      this.usageByTapp.set(tappId, {})
    }
    return this.usageByTapp.get(tappId)!
  }

  /** Bridge 使用具体 action 名；配额按能力族聚合。 */
  private normalizeType(type: string): string {
    if (
      [
        'platform.listEnabled',
        'platform.getData',
        'platform.getStats',
        'platform.getDistribution',
      ].includes(type)
    ) {
      return 'platform.read'
    }
    if (
      [
        'platform.addItem',
        'platform.addItems',
        'platform.registerPlatform',
      ].includes(type)
    ) {
      return 'platform.write'
    }
    return type
  }

  /** 获取或创建特定类型的使用记录（带滑动窗口限制器） */
  private getTypeUsage(tappId: string, type: string): UsageRecord {
    const usage = this.getUsage(tappId)
    if (!usage[type]) {
      let maxRequests: number

      if (type === 'platform.read') {
        maxRequests = this.quotaConfig.platform.readPerMinute
      } else if (type === 'platform.write') {
        maxRequests = this.quotaConfig.platform.writePerMinute
      } else {
        maxRequests = this.quotaConfig.apiExecutePerMinute
      }

      usage[type] = {
        lastUsedAt: Date.now(),
        rateLimiter: new SlidingWindowRateLimiter(60 * 1000, maxRequests),
      }
    }
    return usage[type]
  }

  /**
   * 检查配额是否允许操作（增强版：包含滑动窗口检查）
   */
  checkQuota(
    tappId: string,
    type: string,
  ): {
    allowed: boolean
    remaining: number
    reason?: string
    retryAfter?: number
  } {
    type = this.normalizeType(type)

    switch (type) {
      case 'platform.read':
      case 'platform.write':
      case 'api.execute':
        break
      default:
        // 未跟踪的 action 不创建使用记录。AI 使用量由后端持久化账本统一记录。
        return { allowed: true, remaining: Infinity }
    }

    const record = this.getTypeUsage(tappId, type)
    const rateCheck = record.rateLimiter.check()
    if (!rateCheck.allowed) {
      return {
        allowed: false,
        remaining: 0,
        reason: `速率限制：请求过于频繁，请在 ${Math.ceil((rateCheck.retryAfter || 0) / 1000)} 秒后重试`,
        retryAfter: rateCheck.retryAfter,
      }
    }
    return { allowed: true, remaining: rateCheck.remaining }
  }

  /**
   * 记录使用（同时更新滑动窗口）
   */
  recordUsage(tappId: string, type: string): void {
    type = this.normalizeType(type)
    if (!['platform.read', 'platform.write', 'api.execute'].includes(type)) {
      return
    }
    const record = this.getTypeUsage(tappId, type)
    record.lastUsedAt = Date.now()
    record.rateLimiter.record()
  }
}

/** 全局配额管理器实例 */
let quotaManagerInstance: TappQuotaManager | null = null

/**
 * 获取配额管理器实例
 */
export function getQuotaManager(): TappQuotaManager {
  if (!quotaManagerInstance) {
    quotaManagerInstance = new TappQuotaManager()
  }
  return quotaManagerInstance
}

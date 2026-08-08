/**
 * 请求去重工具(静态官网版)
 *
 * 解决多个组件同时请求相同外部 API(天气/地理位置)导致的重复网络请求问题。
 * 使用 Promise 共享机制，确保相同的请求在短时间内只发起一次。
 */

// 进行中的请求缓存
const pendingRequests = new Map<string, Promise<any>>()

// 已完成请求的结果缓存
const resultCache = new Map<string, { data: any; timestamp: number }>()

/**
 * 每 key 代际：clearDedupCache 后 +1。
 * 防止「清缓存时仍在飞的旧请求完成时把过期数据写回 resultCache」
 * （保存壁纸/Evocative 后软刷新若撞上启动期的 config/ui 飞行请求，会读回旧开关）
 */
const cacheGeneration = new Map<string, number>()

// 🔧 性能优化：LRU 缓存最大容量
const MAX_CACHE_SIZE = 50

// 默认缓存时间（毫秒）
const DEFAULT_CACHE_TTL = 30 * 1000 // 30秒

function generationOf(key: string): number {
  return cacheGeneration.get(key) ?? 0
}

function bumpGeneration(key: string): void {
  cacheGeneration.set(key, generationOf(key) + 1)
}

/**
 * 🔧 LRU 缓存清理 - 删除最早的条目直到缓存大小正常
 */
function ensureCacheSize() {
  if (resultCache.size <= MAX_CACHE_SIZE) return

  // Map 保持插入顺序，所以第一个就是最早的
  const keysToDelete: string[] = []
  const deleteCount = resultCache.size - MAX_CACHE_SIZE

  let count = 0
  for (const key of resultCache.keys()) {
    if (count >= deleteCount) break
    keysToDelete.push(key)
    count++
  }

  keysToDelete.forEach((key) => resultCache.delete(key))
}

/**
 * 🔧 读取缓存并更新 LRU 顺序
 */
function getCacheWithLRU(
  key: string,
): { data: any; timestamp: number } | undefined {
  const cached = resultCache.get(key)
  if (cached) {
    // 删除并重新插入，使其移到末尾（最新）
    resultCache.delete(key)
    resultCache.set(key, cached)
  }
  return cached
}

export interface DedupOptions {
  /** 缓存时间（毫秒），默认 30 秒 */
  cacheTTL?: number
  /** 是否跳过缓存，强制重新请求 */
  forceRefresh?: boolean
  /** 缓存键（默认使用 URL） */
  cacheKey?: string
}

/**
 * 去重请求包装器
 *
 * @param url 请求 URL
 * @param fetchFn 实际的 fetch 函数
 * @param options 配置选项
 * @returns Promise<T>
 *
 * @example
 * ```ts
 * // 基本用法
 * const data = await dedupedFetch('/api/config/ui', () =>
 *   fetch('/api/config/ui').then(r => r.json())
 * );
 *
 * // 自定义缓存时间
 * const weather = await dedupedFetch('/api/weather', fetchWeather, {
 *   cacheTTL: 5 * 60 * 1000 // 5分钟
 * });
 * ```
 */
export async function dedupedFetch<T>(
  url: string,
  fetchFn: () => Promise<T>,
  options: DedupOptions = {},
): Promise<T> {
  const {
    cacheTTL = DEFAULT_CACHE_TTL,
    forceRefresh = false,
    cacheKey = url,
  } = options

  // 1. 检查结果缓存（非强制刷新时）- 🔧 使用 LRU 读取
  if (!forceRefresh) {
    const cached = getCacheWithLRU(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data as T
    }
  }

  // 2. 检查是否有进行中的相同请求
  const pending = pendingRequests.get(cacheKey)
  if (pending) {
    return pending as Promise<T>
  }

  // 3. 发起新请求（记录代际，避免 clear 后旧响应污染缓存）
  const genAtStart = generationOf(cacheKey)
  const requestPromise = fetchFn()
    .then((data) => {
      if (generationOf(cacheKey) === genAtStart) {
        ensureCacheSize()
        resultCache.set(cacheKey, { data, timestamp: Date.now() })
      }
      return data
    })
    .finally(() => {
      // 仅清除「自己」登记的 pending，避免清缓存后新请求被误删
      if (pendingRequests.get(cacheKey) === requestPromise) {
        pendingRequests.delete(cacheKey)
      }
    })

  // 4. 记录进行中的请求
  pendingRequests.set(cacheKey, requestPromise)

  return requestPromise
}

/**
 * 清除指定 URL 的缓存
 */
export function clearDedupCache(url?: string): void {
  if (url) {
    bumpGeneration(url)
    resultCache.delete(url)
    pendingRequests.delete(url)
  } else {
    for (const key of resultCache.keys()) bumpGeneration(key)
    for (const key of pendingRequests.keys()) bumpGeneration(key)
    resultCache.clear()
    pendingRequests.clear()
  }
}

/**
 * 预热缓存（后台预加载）
 */
export function prefetchDedup<T>(
  url: string,
  fetchFn: () => Promise<T>,
  options?: DedupOptions,
): void {
  // 使用 requestIdleCallback 或 setTimeout 延迟执行
  const prefetch = () => {
    dedupedFetch(url, fetchFn, options).catch(() => {
      // 预热失败静默处理
    })
  }

  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(prefetch, { timeout: 5000 })
  } else {
    setTimeout(prefetch, 1000)
  }
}

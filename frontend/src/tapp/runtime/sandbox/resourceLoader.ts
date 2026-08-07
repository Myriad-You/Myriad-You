/**
 * Tapp 资源加载器
 *
 * 🎯 设计目标：
 * - 统一的资源加载接口
 * - Widget 和 Page 完全分离处理
 * - CSS 从源头拆分：Widget CSS 和 Page CSS 独立生成
 * - 智能缓存和请求去重
 * - 真正的按需加载（只加载当前模式需要的资源）
 *
 * 架构说明：
 * - Widget 资源：需要按尺寸加载 HTML 模板，CSS 只包含 Widget 相关类
 * - Page 资源：单一 HTML 模板，CSS 只包含 Page 相关类
 * - CSS 策略：
 *   1. 分离式生成：Widget 和 Page 各自有独立的 CSS
 *   2. 后端预编译：优先使用后端存储的分离 CSS
 *   3. 前端降级：如果后端没有分离 CSS，前端按需生成
 *   4. 惰性更新：生成后异步同步到后端
 *
 * 🔒 性能优化：
 * - Widget CSS 只分析: widgetTemplates + widget code + styles
 * - Page CSS 只分析: pageTemplate + page code + styles
 * - 避免加载不必要的资源（Widget 不加载 Page 模板，反之亦然）
 */

import type { TappInstance } from '../../types'
import * as TappApiService from '../../services/TappApiService'
import { generateOnDemandTailwindCSS } from './styles'

// ============ 类型定义 ============

/** Headless core 资源（后台任务专用） */
export interface CoreResources {
  /** 仅包含共享核心逻辑，不包含 Page / Widget 代码 */
  core: string
  /** core 可能使用的翻译数据 */
  i18n?: Record<string, unknown>
}

/** Widget 资源（特化类型） */
export interface WidgetResources {
  /** 核心 JS 代码 */
  core: string
  /** Widget 专用 JS 代码 */
  widget?: string
  /** Widget HTML 模板（已按尺寸选择） */
  html: string
  /** 自定义 CSS（通用样式或 Widget 专用样式） */
  styles?: string
  /** Widget 专用 Tailwind CSS */
  css: string
  /** Widget 尺寸 */
  size: string
  /** CSS 架构模式 */
  cssMode?: 'unified' | 'separated'
}

/** Page 资源（特化类型） */
export interface PageResources {
  /** 核心 JS 代码 */
  core: string
  /** Page 专用 JS 代码 */
  page?: string
  /** Page HTML 模板 */
  html?: string
  /** 自定义 CSS（通用样式或 Page 专用样式） */
  styles?: string
  /** Page 专用 Tailwind CSS */
  css: string
  /** CSS 架构模式 */
  cssMode?: 'unified' | 'separated'
  /** i18n 翻译数据（语言代码 → 键值对） */
  i18n?: Record<string, unknown>
  /** Page 模块文件（文件名 → 代码内容） */
  pageModules?: Record<string, string>
  /** Page 模块加载顺序 */
  pageModuleOrder?: string[]
}

/** 资源缓存项 */
interface ResourceCacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// ============ 缓存配置 ============

const CACHE_TTL = {
  widget: 5 * 60 * 1000, // Widget 资源 5 分钟
  page: 10 * 60 * 1000, // Page 资源 10 分钟
  separatedCss: 60 * 60 * 1000, // 分离 CSS 1 小时
}

const CACHE_LIMIT = {
  widget: 60,
  page: 30,
  raw: 30,
  widgetCss: 60,
  pageCss: 30,
} as const

function getCachedEntry<T>(
  cache: Map<string, ResourceCacheEntry<T>>,
  key: string,
): ResourceCacheEntry<T> | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp >= entry.ttl) {
    cache.delete(key)
    return undefined
  }
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

function setCachedEntry<T>(
  cache: Map<string, ResourceCacheEntry<T>>,
  key: string,
  entry: ResourceCacheEntry<T>,
  maxEntries: number,
): void {
  cache.delete(key)
  cache.set(key, entry)
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

// ============ 请求去重器 ============

class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>()

  async dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>

    const promise = factory().finally(() => this.pending.delete(key))
    this.pending.set(key, promise)
    return promise
  }
}

// ============ CSS 分离器 ============

/**
 * CSS 分离工具
 *
 * 负责将源码按模式分离，生成独立的 CSS
 */
class CssSeparator {
  /**
   * 为 Widget 模式生成 CSS
   * 只分析 Widget 相关的源码
   */
  static generateWidgetCSS(
    core: string,
    widgetCode: string | undefined,
    widgetHtml: string,
    styles: string | undefined,
  ): string {
    const sources = [
      core || '',
      widgetCode || '',
      widgetHtml || '',
      styles || '',
    ].join('\n')

    return generateOnDemandTailwindCSS(sources)
  }

  /**
   * 为 Page 模式生成 CSS
   * 只分析 Page 相关的源码
   */
  static generatePageCSS(
    core: string,
    pageCode: string | undefined,
    pageHtml: string | undefined,
    styles: string | undefined,
    pageModules?: Record<string, string>,
  ): string {
    const sources = [
      core || '',
      pageCode || '',
      pageHtml || '',
      styles || '',
      ...Object.values(pageModules || {}),
    ].join('\n')

    return generateOnDemandTailwindCSS(sources)
  }
}

// ============ 资源加载器类 ============

/**
 * Tapp 资源加载器
 *
 * 负责加载和缓存 Tapp 的代码、CSS、HTML 模板等资源
 *
 * 🎯 核心特性：
 * - Widget 和 Page CSS 完全分离生成
 * - 按需加载：只加载当前模式需要的资源
 * - 智能缓存：分离的 CSS 独立缓存
 */
export class TappResourceLoader {
  private static instance: TappResourceLoader | null = null

  /** Widget 资源缓存 (key: tappId:widgetId:size) */
  private widgetCache = new Map<string, ResourceCacheEntry<WidgetResources>>()

  /** Page 资源缓存 (key: tappId) */
  private pageCache = new Map<string, ResourceCacheEntry<PageResources>>()

  /** Headless core 资源缓存 (key: tappId) */
  private coreCache = new Map<string, ResourceCacheEntry<CoreResources>>()

  /** 原始资源缓存（从 API 获取，多个尺寸共享） */
  private rawResourceCache = new Map<
    string,
    ResourceCacheEntry<TappApiService.TappResources>
  >()

  /** Widget CSS 缓存 (key: tappId:widgetId:size) */
  private widgetCssCache = new Map<string, ResourceCacheEntry<string>>()

  /** Page CSS 缓存 (key: tappId) */
  private pageCssCache = new Map<string, ResourceCacheEntry<string>>()

  /** 请求去重器 */
  private deduplicator = new RequestDeduplicator()

  /** 每个 Tapp 的缓存代际；清缓存后旧请求不得回填新代际。 */
  private cacheGenerations = new Map<string, number>()

  private constructor() {}

  private generationFor(tappId: string): number {
    const current = this.cacheGenerations.get(tappId)
    if (current !== undefined) return current
    // 记录所有启动过加载的 ID。这样 clearCache() 即使发生在首次请求尚未回填
    // 任意缓存时，也能提升其代际并阻止旧请求复活缓存。
    this.cacheGenerations.set(tappId, 0)
    return 0
  }

  private generationIsCurrent(tappId: string, generation: number): boolean {
    return this.generationFor(tappId) === generation
  }

  static getInstance(): TappResourceLoader {
    if (!TappResourceLoader.instance) {
      TappResourceLoader.instance = new TappResourceLoader()
    }
    return TappResourceLoader.instance
  }

  // ============ Headless core 资源加载 ============

  /**
   * 加载后台 core 运行所需的最小资源。
   *
   * 不生成 Page CSS、不保留 Page HTML / 模块，避免后台 runner 因复用
   * loadPageResources 而做无用的样式分析和页面缓存。
   */
  async loadCoreResources(tappInstance: TappInstance): Promise<CoreResources> {
    const cacheKey = tappInstance.id
    const generation = this.generationFor(tappInstance.id)
    const cached = getCachedEntry(this.coreCache, cacheKey)
    if (cached) return cached.data

    return this.deduplicator.dedupe(
      `core:${cacheKey}:${generation}`,
      async () => {
        const raw = await this.fetchRawResources(tappInstance.id)
        if (!this.generationIsCurrent(tappInstance.id, generation)) {
          return this.loadCoreResources(tappInstance)
        }
        const resources: CoreResources = {
          core: this.extractCoreCode(raw.code),
          i18n: raw.i18n,
        }

        setCachedEntry(
          this.coreCache,
          cacheKey,
          {
            data: resources,
            timestamp: Date.now(),
            ttl: CACHE_TTL.page,
          },
          CACHE_LIMIT.page,
        )

        return resources
      },
    )
  }

  // ============ Widget 资源加载 ============

  /**
   * 加载 Widget 资源
   *
   * 🎯 按需加载策略：
   * - 只加载 Widget 需要的 HTML 模板
   * - CSS 只包含 Widget 相关的类
   * - 不加载 Page 相关的资源
   *
   * @param tappInstance - Tapp 实例
   * @param size - Widget 尺寸 (如 '2x2', '4x2')
   * @returns Widget 专用资源
   */
  async loadWidgetResources(
    tappInstance: TappInstance,
    size: string,
    widgetId: string,
  ): Promise<WidgetResources> {
    const cacheKey = `${tappInstance.id}:${widgetId}:${size}`
    const generation = this.generationFor(tappInstance.id)

    // 检查缓存
    const cached = getCachedEntry(this.widgetCache, cacheKey)
    if (cached) return cached.data

    // 使用请求去重
    return this.deduplicator.dedupe(
      `widget:${cacheKey}:${generation}`,
      async () => {
        // 获取原始资源
        const raw = await this.fetchRawResources(tappInstance.id)
        if (!this.generationIsCurrent(tappInstance.id, generation)) {
          return this.loadWidgetResources(tappInstance, size, widgetId)
        }

        // 提取代码
        const coreCode = this.extractCoreCode(raw.code)
        const widgetCode = this.extractModeCode(raw.code, 'widget')

        // 选择对应尺寸的 HTML 模板
        let html = ''
        const templates = raw.widgetTemplates?.[widgetId]
        if (templates) {
          html = templates[size] || ''
          if (!html) {
            const defaultKey = Object.keys(templates)[0]
            if (defaultKey) html = templates[defaultKey]
          }
        }

        // 🎯 确定 CSS 架构模式和样式来源
        const cssMode = raw.cssMode || 'unified'
        // 分离模式：合并 styles（共享）+ widgetStyles（专用）
        // 统一模式：仅使用 styles
        let effectiveStyles: string | undefined
        if (cssMode === 'separated') {
          // 混合模式：共享样式 + Widget 专用样式
          const parts: string[] = []
          if (raw.styles) parts.push(raw.styles)
          if (raw.widgetStyles) parts.push(raw.widgetStyles)
          effectiveStyles = parts.length > 0 ? parts.join('\n') : undefined
        } else {
          effectiveStyles = raw.styles
        }

        // 🎯 生成 Widget 专用 CSS
        // 原生 CSS 由 styles 字段单独交给沙箱；这里仅处理 Tailwind CSS。
        const tailwindCSS = await this.ensureWidgetCSS(
          tappInstance.id,
          widgetId,
          size,
          coreCode,
          widgetCode,
          html,
          effectiveStyles,
          raw.widgetCSS, // 使用后端预分离的 Widget CSS
        )
        // 原生 CSS 由 resources.styles 单独注入；这里只保留生成/预编译 CSS，
        // 避免 separated 模式把同一份样式写进 iframe 两次。
        const css = tailwindCSS

        const resources: WidgetResources = {
          core: coreCode,
          widget: widgetCode,
          html,
          styles: effectiveStyles,
          css,
          size,
          cssMode,
        }

        if (!this.generationIsCurrent(tappInstance.id, generation)) {
          return this.loadWidgetResources(tappInstance, size, widgetId)
        }

        // 存入缓存
        setCachedEntry(
          this.widgetCache,
          cacheKey,
          {
            data: resources,
            timestamp: Date.now(),
            ttl: CACHE_TTL.widget,
          },
          CACHE_LIMIT.widget,
        )

        return resources
      },
    )
  }

  // ============ Page 资源加载 ============

  /**
   * 加载 Page 资源
   *
   * 🎯 按需加载策略：
   * - 只加载 Page 需要的 HTML 模板
   * - CSS 只包含 Page 相关的类
   * - 不加载 Widget 相关的资源
   *
   * @param tappInstance - Tapp 实例
   * @returns Page 专用资源
   */
  async loadPageResources(tappInstance: TappInstance): Promise<PageResources> {
    const cacheKey = tappInstance.id
    const generation = this.generationFor(tappInstance.id)

    // 检查缓存
    const cached = getCachedEntry(this.pageCache, cacheKey)
    if (cached) return cached.data

    // 使用请求去重
    return this.deduplicator.dedupe(
      `page:${cacheKey}:${generation}`,
      async () => {
        // 获取原始资源
        const raw = await this.fetchRawResources(tappInstance.id)
        if (!this.generationIsCurrent(tappInstance.id, generation)) {
          return this.loadPageResources(tappInstance)
        }

        // 提取代码
        const coreCode = this.extractCoreCode(raw.code)
        const pageCode = this.extractModeCode(raw.code, 'page')

        // 🎯 确定 CSS 架构模式和样式来源
        const cssMode = raw.cssMode || 'unified'
        // 分离模式：合并 styles（共享）+ pageStyles（专用）
        // 统一模式：仅使用 styles
        let effectiveStyles: string | undefined
        if (cssMode === 'separated') {
          // 混合模式：共享样式 + Page 专用样式
          const parts: string[] = []
          if (raw.styles) parts.push(raw.styles)
          if (raw.pageStyles) parts.push(raw.pageStyles)
          effectiveStyles = parts.length > 0 ? parts.join('\n') : undefined
        } else {
          effectiveStyles = raw.styles
        }

        // 🎯 生成 Page 专用 CSS
        // 原生 CSS 由 styles 字段单独交给沙箱；这里仅处理 Tailwind CSS。
        const tailwindCSS = await this.ensurePageCSS(
          tappInstance.id,
          coreCode,
          pageCode,
          raw.pageTemplate,
          effectiveStyles,
          raw.pageCSS, // 使用后端预分离的 Page CSS
          raw.pageModules,
        )
        // 原生 CSS 由 resources.styles 单独注入，避免 separated 模式重复注入。
        const css = tailwindCSS

        const resources: PageResources = {
          core: coreCode,
          page: pageCode,
          html: raw.pageTemplate,
          styles: effectiveStyles,
          css,
          cssMode,
          i18n: raw.i18n,
          pageModules: raw.pageModules,
          pageModuleOrder: raw.pageModuleOrder,
        }

        if (!this.generationIsCurrent(tappInstance.id, generation)) {
          return this.loadPageResources(tappInstance)
        }

        // 存入缓存
        setCachedEntry(
          this.pageCache,
          cacheKey,
          {
            data: resources,
            timestamp: Date.now(),
            ttl: CACHE_TTL.page,
          },
          CACHE_LIMIT.page,
        )

        return resources
      },
    )
  }

  // ============ CSS 处理（分离式） ============

  /**
   * 确保有 Widget 专用的 CSS
   *
   * 策略（优先级从高到低）：
   * 1. 使用后端预分离的 Widget CSS（widget.css）
   * 2. 前端从源码生成 Widget 专用 CSS
   */
  private async ensureWidgetCSS(
    tappId: string,
    widgetId: string,
    size: string,
    coreCode: string,
    widgetCode: string | undefined,
    widgetHtml: string,
    styles: string | undefined,
    precompiledWidgetCSS: string | undefined,
  ): Promise<string> {
    const cacheKey = `${tappId}:${widgetId}:${size}`

    // 检查缓存
    const cached = getCachedEntry(this.widgetCssCache, cacheKey)
    if (cached) return cached.data

    let css: string

    // 🎯 策略 1: 优先使用后端预分离的 Widget CSS
    if (precompiledWidgetCSS !== undefined) {
      css = precompiledWidgetCSS
    } else {
      // 策略 2: 从源码生成 Widget 专用 CSS
      css = CssSeparator.generateWidgetCSS(
        coreCode,
        widgetCode,
        widgetHtml,
        styles,
      )
    }

    // 缓存
    setCachedEntry(
      this.widgetCssCache,
      cacheKey,
      {
        data: css,
        timestamp: Date.now(),
        ttl: CACHE_TTL.separatedCss,
      },
      CACHE_LIMIT.widgetCss,
    )

    return css
  }

  /**
   * 确保有 Page 专用的 CSS
   *
   * 策略（优先级从高到低）：
   * 1. 使用后端预分离的 Page CSS（page.css）
   * 2. 前端从源码生成 Page 专用 CSS
   */
  private async ensurePageCSS(
    tappId: string,
    coreCode: string,
    pageCode: string | undefined,
    pageHtml: string | undefined,
    styles: string | undefined,
    precompiledPageCSS: string | undefined,
    pageModules?: Record<string, string>,
  ): Promise<string> {
    const cacheKey = tappId

    // 检查缓存
    const cached = getCachedEntry(this.pageCssCache, cacheKey)
    if (cached) return cached.data

    let css: string

    // 🎯 策略 1: 优先使用后端预分离的 Page CSS
    if (precompiledPageCSS !== undefined) {
      css = precompiledPageCSS
    } else {
      // 策略 2: 从源码生成 Page 专用 CSS
      css = CssSeparator.generatePageCSS(
        coreCode,
        pageCode,
        pageHtml,
        styles,
        pageModules,
      )
    }

    // 缓存
    setCachedEntry(
      this.pageCssCache,
      cacheKey,
      {
        data: css,
        timestamp: Date.now(),
        ttl: CACHE_TTL.separatedCss,
      },
      CACHE_LIMIT.pageCss,
    )

    return css
  }

  // ============ 原始资源获取 ============

  /**
   * 获取原始资源（带缓存）
   */
  private async fetchRawResources(
    tappId: string,
  ): Promise<TappApiService.TappResources> {
    const generation = this.generationFor(tappId)
    const cached = getCachedEntry(this.rawResourceCache, tappId)
    if (cached) return cached.data

    return this.deduplicator.dedupe(`raw:${tappId}:${generation}`, async () => {
      try {
        const resources = await TappApiService.getTappResources(tappId)

        if (!this.generationIsCurrent(tappId, generation)) {
          return this.fetchRawResources(tappId)
        }

        setCachedEntry(
          this.rawResourceCache,
          tappId,
          {
            data: resources,
            timestamp: Date.now(),
            ttl: CACHE_TTL.widget, // 使用较短的 TTL
          },
          CACHE_LIMIT.raw,
        )

        return resources
      } catch {
        // 回退到只获取代码
        const code = await TappApiService.getTappCode(tappId)
        if (!this.generationIsCurrent(tappId, generation)) {
          return this.fetchRawResources(tappId)
        }
        return { code }
      }
    })
  }

  // ============ 代码提取 ============

  /**
   * 提取核心代码（去除 widget/page 专用部分）
   */
  private extractCoreCode(fullCode: string): string {
    // 查找分隔标记
    const widgetMarker = '// ========== Widget Code =========='
    const pageMarker = '// ========== Page Code =========='

    let code = fullCode

    // 移除 Widget 代码部分
    const widgetIdx = code.indexOf(widgetMarker)
    if (widgetIdx !== -1) {
      const pageIdx = code.indexOf(pageMarker, widgetIdx)
      if (pageIdx !== -1) {
        code = code.substring(0, widgetIdx) + code.substring(pageIdx)
      } else {
        code = code.substring(0, widgetIdx)
      }
    }

    // 移除 Page 代码部分
    const pageOnlyIdx = code.indexOf(pageMarker)
    if (pageOnlyIdx !== -1) {
      code = code.substring(0, pageOnlyIdx)
    }

    return code.trim()
  }

  /**
   * 提取特定模式的代码
   */
  private extractModeCode(
    fullCode: string,
    mode: 'widget' | 'page',
  ): string | undefined {
    const marker =
      mode === 'widget'
        ? '// ========== Widget Code =========='
        : '// ========== Page Code =========='

    const startIdx = fullCode.indexOf(marker)
    if (startIdx === -1) return undefined

    const codeStart = startIdx + marker.length

    // 查找下一个标记或结尾
    const otherMarker =
      mode === 'widget'
        ? '// ========== Page Code =========='
        : '// ========== Widget Code =========='

    const endIdx = fullCode.indexOf(otherMarker, codeStart)

    if (endIdx !== -1) {
      return fullCode.substring(codeStart, endIdx).trim()
    }

    return fullCode.substring(codeStart).trim()
  }

  // ============ 缓存管理 ============

  /**
   * 清除指定 Tapp 的缓存
   */
  clearCache(tappId?: string): void {
    if (tappId) {
      this.cacheGenerations.set(tappId, this.generationFor(tappId) + 1)
      // 清除该 Tapp 的所有缓存
      for (const key of this.widgetCache.keys()) {
        if (key.startsWith(`${tappId}:`)) {
          this.widgetCache.delete(key)
        }
      }
      for (const key of this.widgetCssCache.keys()) {
        if (key.startsWith(`${tappId}:`)) {
          this.widgetCssCache.delete(key)
        }
      }
      this.coreCache.delete(tappId)
      this.pageCache.delete(tappId)
      this.pageCssCache.delete(tappId)
      this.rawResourceCache.delete(tappId)
    } else {
      for (const tappId of this.cacheGenerations.keys()) {
        this.cacheGenerations.set(tappId, this.generationFor(tappId) + 1)
      }
      // 清除所有缓存
      this.coreCache.clear()
      this.widgetCache.clear()
      this.pageCache.clear()
      this.rawResourceCache.clear()
      this.widgetCssCache.clear()
      this.pageCssCache.clear()
    }
  }
}

// ============ 导出便捷函数 ============

/**
 * 获取资源加载器实例
 */
export function getResourceLoader(): TappResourceLoader {
  return TappResourceLoader.getInstance()
}

/**
 * 加载 Widget 资源（便捷函数）
 */
export async function loadWidgetResources(
  tappInstance: TappInstance,
  size: string,
  widgetId: string,
): Promise<WidgetResources> {
  return getResourceLoader().loadWidgetResources(tappInstance, size, widgetId)
}

/** 加载 Headless core 资源（便捷函数） */
export async function loadCoreResources(
  tappInstance: TappInstance,
): Promise<CoreResources> {
  return getResourceLoader().loadCoreResources(tappInstance)
}

/**
 * 加载 Page 资源（便捷函数）
 */
export async function loadPageResources(
  tappInstance: TappInstance,
): Promise<PageResources> {
  return getResourceLoader().loadPageResources(tappInstance)
}

export default TappResourceLoader

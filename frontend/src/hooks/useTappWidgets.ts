/**
 * Tapp Widgets Hook
 * 管理 Tapp 注册的小组件并提供给 WidgetGrid 使用
 */

import type {
  WidgetComponentProps,
  WidgetSize,
  WidgetType,
} from '../components/WidgetGrid'
import type { RegisteredWidget } from '../tapp/types'
import {
  createElement,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

// TappWidget 与其背后的整个 tapp runtime / 沙箱体系（生产 ~300KB）按需加载：
// 布局中没有 Tapp 小组件时，Home 首屏不需要执行这部分代码。
// 渲染点的 Suspense 由 WidgetGrid 提供。
const TappWidgetComponent = lazy(() =>
  import('../components/widgets/TappWidget').then((m) => ({
    default: m.TappWidgetComponent,
  })),
)

type TappRuntimeModule = typeof import('../tapp/runtime')

let runtimeModulePromise: Promise<TappRuntimeModule> | null = null

/** 共享的 runtime 模块动态加载（模块级缓存，多个调用方只加载一次） */
function loadTappRuntimeModule(): Promise<TappRuntimeModule> {
  runtimeModulePromise ||= import('../tapp/runtime')
  return runtimeModulePromise
}

// Tapp WidgetSize 到 WidgetGrid WidgetSize 的映射
const TAPP_SIZE_MAP: Record<string, WidgetSize> = {
  '1x1': '1x1',
  '2x1': '2x1',
  '1x2': '1x2',
  '2x2': '2x2',
  '2x3': '2x3',
  '3x2': '3x2',
  '3x3': '3x3',
  '2x4': '2x4',
  '4x1': '4x1',
  '4x2': '4x2',
  '4x4': '4x4',
}

// 将 Tapp WidgetSize 转换为 WidgetGrid 兼容的尺寸
function mapTappSize(size: string | undefined): WidgetSize {
  if (!size) return '2x2'
  return TAPP_SIZE_MAP[size] || '2x2'
}

// 将 Tapp WidgetSize 数组转换为 WidgetGrid 兼容的尺寸数组
function mapTappSizes(sizes: string[] | undefined): WidgetSize[] {
  if (!sizes || !Array.isArray(sizes)) {
    return ['2x2'] // 默认尺寸
  }
  const mapped = sizes
    .map((s) => TAPP_SIZE_MAP[s])
    .filter((s): s is WidgetSize => s !== undefined)
  return mapped.length > 0 ? mapped : ['2x2']
}

/**
 * 扩展 WidgetType 以支持 Tapp 元数据
 */
export interface TappWidgetType extends WidgetType {
  isTappWidget: boolean
  tappId: string
  category?: string
}

/**
 * Tapp Widget 到 WidgetType 的适配器
 */
function createTappWidgetType(widget: RegisteredWidget): TappWidgetType {
  const config = widget.config || {}

  // 创建一个包装组件 - 使用 createElement 而不是 JSX
  const WrappedComponent = (props: WidgetComponentProps) =>
    createElement(TappWidgetComponent, {
      ...props,
      tappWidgetId: widget.id,
    })
  WrappedComponent.displayName = `TappWidget_${widget.id}`

  return {
    id: widget.id,
    name: config.name || 'Unknown Widget',
    defaultSize: mapTappSize(config.defaultSize),
    component: WrappedComponent,
    supportedSizes: mapTappSizes(config.sizes),
    settings: config.settings,
    // Tapp 特定字段
    isTappWidget: true,
    tappId: widget.tappId,
    category: config.category,
  }
}

/**
 * useTappWidgets Hook
 * 监听 Tapp Runtime 的 Widget 注册事件并返回可用的 Widget 类型
 *
 * 重要：会等待 TappRuntime 同步完成后再加载小组件。
 * runtime 模块本身为动态加载，不进入 Home 首屏关键路径。
 */
export function useTappWidgets(): {
  tappWidgets: TappWidgetType[]
  isLoading: boolean
  error: string | null
  refreshWidgets: () => void
} {
  const [tappWidgets, setTappWidgets] = useState<TappWidgetType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 异步加载：等待 runtime 模块加载 + 同步完成后再读取
  const loadWidgetsAsync = useCallback(async () => {
    try {
      setIsLoading(true)
      const { getTappRuntime } = await loadTappRuntimeModule()
      const runtime = getTappRuntime()

      // 等待 runtime 同步完成
      await runtime.waitForSync()

      const registeredWidgets = runtime.getRegisteredWidgets()
      const widgetTypes = registeredWidgets.map(createTappWidgetType)
      // 有注册的 Tapp 小组件时提前预热组件模块，避免渲染时才拉 chunk
      if (widgetTypes.length > 0) {
        void import('../components/widgets/TappWidget').catch(() => {})
      }
      setTappWidgets(widgetTypes)
      setError(null)
    } catch (err) {
      console.error('[useTappWidgets] Failed to load widgets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load widgets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始加载 - 等待同步完成
  useEffect(() => {
    loadWidgetsAsync()
  }, [loadWidgetsAsync])

  // 监听 Widget 注册/注销事件 和 同步完成事件
  useEffect(() => {
    let disposed = false
    const unsubs: Array<() => void> = []

    loadTappRuntimeModule()
      .then(({ getTappRuntime }) => {
        if (disposed) return
        const runtime = getTappRuntime()

        // 同步方法：runtime 已就绪时直接读取注册表
        const reloadSync = () => {
          try {
            const registeredWidgets = runtime.getRegisteredWidgets()
            setTappWidgets(registeredWidgets.map(createTappWidgetType))
            setError(null)
          } catch (err) {
            console.error('[useTappWidgets] Failed to load widgets:', err)
            setError(
              err instanceof Error ? err.message : 'Failed to load widgets',
            )
          } finally {
            setIsLoading(false)
          }
        }

        // 当有新的 widget 注册/注销、后端同步完成时更新
        unsubs.push(runtime.on('widget:registered', reloadSync))
        unsubs.push(runtime.on('widget:unregistered', reloadSync))
        unsubs.push(runtime.on('sync:complete', reloadSync))
      })
      .catch((err) => {
        console.error('[useTappWidgets] Failed to load tapp runtime:', err)
      })

    return () => {
      disposed = true
      unsubs.forEach((unsub) => unsub())
    }
  }, [])

  return {
    tappWidgets,
    isLoading,
    error,
    refreshWidgets: loadWidgetsAsync,
  }
}

/**
 * 合并系统 Widgets 和 Tapp Widgets
 */
export function useCombinedWidgets(systemWidgets: WidgetType[]): WidgetType[] {
  const { tappWidgets } = useTappWidgets()

  return useMemo(() => {
    // 过滤掉重复的（基于 ID）
    const systemIds = new Set(systemWidgets.map((w) => w.id))
    const uniqueTappWidgets = tappWidgets.filter((w) => !systemIds.has(w.id))

    return [...systemWidgets, ...uniqueTappWidgets]
  }, [systemWidgets, tappWidgets])
}

export default useTappWidgets

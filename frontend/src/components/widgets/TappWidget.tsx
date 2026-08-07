/**
 * Tapp Widget 组件
 * 用于在 Dashboard 中渲染 Tapp 提供的小组件
 *
 * 使用 TappWidgetSandbox 实现 Widget 范围的 Tapp SDK API
 *
 * 架构说明：
 * - Widget 从 manifest 预注册，安装后即可在 Dashboard 中添加
 * - 只有当 Tapp 运行中时，Widget 才会真正渲染
 * - 未运行时显示提示，引导用户启动 Tapp
 *
 * 预览模式优化：
 * - 预览模式下渲染美观的 Glass 风格预览卡片
 * - 支持图标、名称、主题色
 * - 添加光晕背景效果，与普通小组件保持一致
 */

import type { RegisteredWidget, TappCodeStructure, TappInstance } from '../../tapp/types'
import type { WidgetComponentProps } from '../WidgetGrid'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { isPageVisible, onVisibility } from '../../hooks/animation'
import { useAnimationLevel } from '../../hooks/useAnimationLevel'
import { TappIcon } from '../../tapp/components/TappIcon'
import { loadWidgetResources } from '../../tapp/runtime/sandbox/resourceLoader'
import { getTappRuntime } from '../../tapp/runtime/TappRuntime'
import { TappWidgetSandbox } from '../../tapp/runtime/TappWidgetSandbox'
import { resolveManifestText } from '../../tapp/utils/manifestLocale'
import { Spinner } from '../Spinner'
import { GlowBackground } from './shared/GlowBackground'
import { WidgetShell } from './shared/WidgetShell'

export interface TappWidgetProps extends WidgetComponentProps {
  /** Tapp Widget 完整 ID (tapp.{tappId}.{widgetId}) */
  tappWidgetId: string
}

/**
 * 获取 Tapp Widget 的预览信息
 * 同步方法，从 runtime 缓存中获取信息
 */
function getTappWidgetPreviewInfo(
  tappWidgetId: string,
  locale?: string,
): {
  name: string
  icon?: string
  iconSvg?: string
  themeColor?: string
  description?: string
  tappName?: string
} | null {
  try {
    const runtime = getTappRuntime()
    const widgets = runtime.getRegisteredWidgets()
    const widget = widgets.find((w) => w.id === tappWidgetId)

    if (!widget) {
      // 从 ID 提取基本信息
      const parts = tappWidgetId.split('.')
      const widgetName = parts.pop() || 'Widget'
      return {
        name: widgetName,
        icon: undefined,
        iconSvg: undefined,
      }
    }

    // 获取 Tapp 实例以获取主题色
    const tapp = runtime.getTapp(widget.tappId)

    return {
      name: widget.config.name || 'Widget',
      icon: widget.config.icon || tapp?.manifest.icon,
      iconSvg: tapp?.manifest.iconSvg,
      themeColor: tapp?.manifest.themeColor,
      description: widget.config.description,
      tappName: tapp
        ? resolveManifestText(tapp.manifest, locale).name
        : undefined,
    }
  } catch {
    // 返回默认值
    const parts = tappWidgetId.split('.')
    const widgetName = parts.pop() || 'Widget'
    return {
      name: widgetName,
      icon: undefined,
      iconSvg: undefined,
    }
  }
}

/**
 * Tapp Widget 预览组件
 * 用于在小组件库中显示实际的 widget 渲染效果
 *
 * 优化策略：
 * - 尝试渲染实际的 widget HTML 内容
 * - 只渲染一次，不监听任何更新事件（节约性能）
 * - 如果无法获取代码则回退到静态预览
 */
const TappWidgetPreview = memo(
  ({
    tappWidgetId,
    config,
    animLevel,
  }: {
    tappWidgetId: string
    config: WidgetComponentProps['config']
    animLevel: 'exlight' | 'light' | 'standard'
  }) => {
    const { locale } = useI18n()

    // 使用 ref 确保只加载一次（但尺寸变化时需要重新加载）
    const loadedRef = useRef(false)
    const prevSizeRef = useRef(config?.size)
    const prevTappWidgetIdRef = useRef(tappWidgetId)
    const [previewData, setPreviewData] = useState<{
      tappInstance: TappInstance
      code: TappCodeStructure
      widget: RegisteredWidget
    } | null>(null)

    // 获取预览信息（用于回退显示）
    const previewInfo = useMemo(
      () => getTappWidgetPreviewInfo(tappWidgetId, locale),
      [tappWidgetId, locale],
    )

    // ⚡ 优化：监听尺寸变化，重新加载资源
    useEffect(() => {
      // 尺寸变化时重置加载状态，触发重新加载
      if (
        prevSizeRef.current !== config?.size ||
        prevTappWidgetIdRef.current !== tappWidgetId
      ) {
        prevSizeRef.current = config?.size
        prevTappWidgetIdRef.current = tappWidgetId
        loadedRef.current = false
        setPreviewData(null)
      }
    }, [config?.size, tappWidgetId])

    // 加载预览数据（尺寸变化时会重新触发）
    useEffect(() => {
      if (loadedRef.current) return
      loadedRef.current = true
      let cancelled = false

      const loadPreviewData = async () => {
        try {
          const runtime = getTappRuntime()

          // 等待 runtime 同步
          await runtime.waitForSync()

          // 查找 widget
          const widgets = runtime.getRegisteredWidgets()
          const widget = widgets.find((w) => w.id === tappWidgetId)
          if (!widget) {
            return
          }

          // 获取 Tapp 实例
          const tapp = runtime.getTapp(widget.tappId)
          if (!tapp) {
            return
          }

          // 检查 Tapp 是否运行中
          const running = runtime.isRunning(widget.tappId)
          if (!running) {
            return
          }

          // 🎯 使用新的资源加载器获取 Widget 专用资源
          // ⚡ 优化：使用当前尺寸加载对应的资源
          const widgetSize = config?.size || widget.config.defaultSize || '4x2'

          try {
            const resources = await loadWidgetResources(
              tapp,
              widgetSize,
              widget.config.id,
            )

            // 转换为 TappWidgetSandbox 需要的 TappCodeStructure
            const tappCode: TappCodeStructure = {
              core: resources.core,
              widget: resources.widget,
              widgetHtml: resources.html,
              styles: resources.styles,
              widgetCSS: resources.css,
            }

            if (!cancelled) {
              setPreviewData({ tappInstance: tapp, code: tappCode, widget })
            }
          } catch {
            // 静态预览已经显示，无需额外失败状态。
          }
        } catch {
          // 静态预览已经显示，无需额外失败状态。
        }
      }

      void loadPreviewData()
      return () => {
        cancelled = true
      }
    }, [tappWidgetId, config?.size])

    // 构造 widgetProps - 只计算一次
    const widgetProps = useMemo(() => {
      const isDark = document.documentElement.classList.contains('dark')
      const primaryColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-primary')
          .trim() || '#8b5cf6'
      return {
        size: config.size,
        config: config.config || {},
        isEditMode: false,
        isPreview: true,
        theme: (isDark ? 'dark' : 'light') as 'light' | 'dark',
        primaryColor,
        locale,
      }
    }, [config.size, config.config, locale])

    // 如果有预览数据，渲染实际的 TappWidgetSandbox
    if (previewData) {
      return (
        <div
          className="relative w-full h-full rounded-xl overflow-hidden"
          style={{ pointerEvents: 'none' }}
        >
          <TappWidgetSandbox
            tappInstance={previewData.tappInstance}
            code={previewData.code}
            widgetId={
              previewData.widget.config.id ||
              previewData.widget.id.split('.').pop() ||
              ''
            }
            widgetProps={widgetProps}
            className="w-full h-full"
          />
          {/* 透明覆盖层 - 确保完全阻止交互 */}
          <div className="absolute inset-0 z-50" />
        </div>
      )
    }

    // 回退：显示静态预览
    // 获取主题色
    const themeColor =
      previewInfo?.themeColor ||
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() ||
      '#8b5cf6'

    // 根据尺寸判断布局
    const isCompact = config.size === '1x1' || config.size === '2x1'
    const isLarge =
      config.size === '4x2' || config.size === '4x4' || config.size === '2x4'

    // 图标样式
    const iconBgStyle = previewInfo?.themeColor
      ? {
          background: `linear-gradient(to bottom right, ${previewInfo.themeColor}, ${previewInfo.themeColor}99)`,
        }
      : undefined
    const iconBgClass = previewInfo?.themeColor
      ? 'bg-linear-to-br'
      : 'bg-linear-to-br from-indigo-500 to-purple-600'

    return (
      <WidgetShell
        padding={12}
        style={{ pointerEvents: 'none' }}
        contentClassName={`flex ${isCompact ? 'items-center justify-center' : 'flex-col justify-center items-center'}`}
        background={
          <>
            <GlowBackground
              color={themeColor}
              animLevel={animLevel}
              shouldAnimate={false}
              variant="single"
              size={isLarge ? 'lg' : 'md'}
              opacity={0.15}
            />
            {/* 边框效果 */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10 pointer-events-none" />
          </>
        }
      >
        {/* 图标 */}
        <div
          className={`${iconBgClass} flex items-center justify-center text-white shadow-lg relative overflow-hidden shrink-0 ${
            isCompact
              ? 'w-8 h-8 rounded-md'
              : isLarge
                ? 'w-14 h-14 rounded-lg mb-3'
                : 'w-10 h-10 rounded-lg mb-2'
          }`}
          style={iconBgStyle}
        >
          <div className="absolute inset-0 bg-linear-to-br from-white/25 to-transparent" />
          <TappIcon
            icon={previewInfo?.icon}
            iconSvg={previewInfo?.iconSvg}
            name={previewInfo?.name || 'Widget'}
            sizeClass={isCompact ? 'w-5 h-5' : isLarge ? 'w-8 h-8' : 'w-6 h-6'}
            textSizeClass={
              isCompact ? 'text-lg' : isLarge ? 'text-2xl' : 'text-xl'
            }
            className="relative z-10"
          />
        </div>

        {/* 文本信息 - 紧凑模式不显示 */}
        {!isCompact && (
          <div className="text-center w-full px-2">
            <div
              className={`font-bold text-gray-800 dark:text-gray-100 truncate ${isLarge ? 'text-base mb-1' : 'text-sm'}`}
            >
              {previewInfo?.name || 'Widget'}
            </div>

            {/* 大尺寸显示描述 */}
            {isLarge && previewInfo?.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {previewInfo.description}
              </div>
            )}

            {/* Tapp 名称 - 仅大尺寸显示 */}
            {isLarge && previewInfo?.tappName && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                  {previewInfo.tappName}
                </span>
              </div>
            )}
          </div>
        )}
      </WidgetShell>
    )
  },
)

TappWidgetPreview.displayName = 'TappWidgetPreview'

/**
 * Tapp Widget 组件（使用 TappWidgetSandbox 隔离运行）
 */
interface TappWidgetRuntimeProps extends TappWidgetProps {
  anim: ReturnType<typeof useAnimationLevel>
}

function TappWidgetRuntime({
  config,
  isEditMode,
  isPreview,
  tappWidgetId,
  onConfigChange,
  anim,
}: TappWidgetRuntimeProps) {
  const runtime = getTappRuntime()
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { locale } = useI18n()
  const [widget, setWidget] = useState<RegisteredWidget | null>(null)
  const [tappInstance, setTappInstance] = useState<TappInstance | null>(null)
  const [code, setCode] = useState<TappCodeStructure | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  // ⚡ 记录上一次的尺寸，用于检测尺寸变化
  const prevSizeRef = useRef(config?.size)

  // 🎯 集成动画调度器的页面可见性感知
  // 页面不可见时跳过非必要的状态更新，减少后台 CPU 开销
  const [pageVisible, setPageVisible] = useState(isPageVisible())
  useEffect(() => {
    return onVisibility(setPageVisible)
  }, [])

  // 🎯 视口门控：widget 的 iframe 沙箱仅在进入视口（附近 300px）时挂载，
  // 远离视口则卸载以释放内存。需要后台常驻数据的 Tapp 由 TappBackgroundRunner
  // 用 headless core 保活，数据不丢；纯展示 widget 重新进入视口时重新挂载即可。
  // 默认 true 避免首屏闪烁；observer 首次回调会立即校正离屏项。
  const [inViewport, setInViewport] = useState(true)
  const viewportObserverRef = useRef<IntersectionObserver | null>(null)
  const sandboxHostRef = useCallback((node: HTMLDivElement | null) => {
    viewportObserverRef.current?.disconnect()
    viewportObserverRef.current = null
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setInViewport(entry.isIntersecting)
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    viewportObserverRef.current = observer
  }, [])
  useEffect(
    () => () => {
      viewportObserverRef.current?.disconnect()
      viewportObserverRef.current = null
    },
    [],
  )

  // 宿主级刷新统一做去抖，避免同一批 storage 写入或多个 invalidate 请求
  // 连续销毁/重建 iframe。刷新只在页面与 Widget 都可见时执行。
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRefresh = useCallback(() => {
    if (!pageVisible || !inViewport) return
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      setRefreshGeneration((generation) => generation + 1)
    }, 500)
  }, [pageVisible, inViewport])
  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    },
    [],
  )

  // ⚡ 监听尺寸变化，重新加载资源
  useEffect(() => {
    // 尺寸变化使用独立的 widgetId + size 缓存键，无需清空整个 Tapp 缓存。
    if (prevSizeRef.current !== config?.size) {
      prevSizeRef.current = config?.size
      if (widget) {
        setError(null)
        setLoading(true)
        setCode(null)
      }
    }
  }, [config?.size, widget])

  // 加载 Widget 信息和代码
  useEffect(() => {
    let cancelled = false

    const loadWidget = async () => {
      setLoading(true)
      setError(null)
      setWidget(null)
      setTappInstance(null)
      setCode(null)
      setIsRunning(false)

      try {
        // 等待 runtime 同步
        await runtime.waitForSync()

        const widgets = runtime.getRegisteredWidgets()
        const found = widgets.find((w) => w.id === tappWidgetId)

        if (!found) {
          if (!cancelled) {
            setError('Widget not found')
            setLoading(false)
          }
          return
        }

        // 获取 Tapp 实例
        const tapp = runtime.getTapp(found.tappId)
        if (!tapp) {
          if (!cancelled) {
            setError('Tapp not found')
            setLoading(false)
          }
          return
        }

        // 检查 Tapp 是否运行中
        const running = runtime.isRunning(found.tappId)

        if (!cancelled) {
          setWidget(found)
          setTappInstance(tapp)
          setIsRunning(running)
          setError(null)
          if (running) {
            // 资源统一由下面的 loadCode effect 加载，避免初次挂载重复执行。
          } else {
            setCode(null)
            setLoading(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load widget')
          setLoading(false)
        }
      }
    }

    loadWidget()

    return () => {
      cancelled = true
    }
  }, [tappWidgetId, runtime])

  // 监听 Tapp 启动/停止事件
  useEffect(() => {
    if (!widget) return

    const handleStarted = (data: unknown) => {
      const eventData = data as { id: string }
      if (eventData.id === widget.tappId) {
        setIsRunning(true)
        // 重新加载
        setError(null)
        setLoading(true)
      }
    }

    const handleStopped = (data: unknown) => {
      const eventData = data as { id: string }
      if (eventData.id === widget.tappId) {
        setIsRunning(false)
        setCode(null)
        setLoading(false)
      }
    }

    const handleUpdated = (data: unknown) => {
      const eventData = data as { id: string }
      if (eventData.id === widget.tappId && runtime.isRunning(widget.tappId)) {
        setError(null)
        setCode(null)
        setLoading(true)
      }
    }

    const unsubStart = runtime.on('tapp:started', handleStarted)
    const unsubStop = runtime.on('tapp:stopped', handleStopped)
    const unsubUpdated = runtime.on('tapp:updated', handleUpdated)

    return () => {
      unsubStart()
      unsubStop()
      unsubUpdated()
    }
  }, [widget, runtime])

  // 重新加载时获取代码
  useEffect(() => {
    if (!loading || !isRunning || !widget || !tappInstance) return
    let cancelled = false

    const loadCode = async () => {
      try {
        // 🎯 使用新的资源加载器获取 Widget 专用资源
        const widgetSize = config?.size || widget.config.defaultSize || '4x2'

        const resources = await loadWidgetResources(
          tappInstance,
          widgetSize,
          widget.config.id,
        )

        // 转换为 TappCodeStructure 格式
        const tappCode: TappCodeStructure = {
          core: resources.core,
          widget: resources.widget,
          widgetHtml: resources.html,
          styles: resources.styles,
          widgetCSS: resources.css,
        }

        if (cancelled) return
        setCode(tappCode)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load code')
        setLoading(false)
      }
    }

    loadCode()
    return () => {
      cancelled = true
    }
  }, [loading, isRunning, widget, tappInstance, config?.size])

  // 使用 useMemo 稳定 widgetProps，避免 TappWidgetSandbox 不必要的重渲染
  // scale 和 fontScale 由 TappWidgetSandbox 内部自动计算并注入到 iframe
  // 使用 JSON.stringify 稳定 config.config 的依赖比较
  const configString = JSON.stringify(config.config || {})
  const declaredDefaults = useMemo(
    () =>
      Object.fromEntries(
        (widget?.config.settings || [])
          .filter((setting) => setting.defaultValue !== undefined)
          .map((setting) => [setting.key, setting.defaultValue]),
      ),
    [widget],
  )
  const widgetProps = useMemo(() => {
    const isDark = document.documentElement.classList.contains('dark')
    // 获取主题色
    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#8b5cf6'
    return {
      size: config.size,
      config: { ...declaredDefaults, ...(config.config || {}) },
      isEditMode: isEditMode || false,
      isPreview: isPreview || false,
      theme: (isDark ? 'dark' : 'light') as 'light' | 'dark',
      primaryColor,
      locale,
    }
  }, [
    config.size,
    configString,
    declaredDefaults,
    isEditMode,
    isPreview,
    locale,
  ])

  const handleInstanceSettingsChange = useCallback(
    (patch: Record<string, unknown>): boolean => {
      if (!widget || !onConfigChange) return false
      const declarations = widget.config.settings || []
      const byKey = new Map(
        declarations.map((setting) => [setting.key, setting]),
      )
      const accepted: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(patch)) {
        const setting = byKey.get(key)
        if (!setting) return false
        if (setting.type === 'toggle' && typeof value !== 'boolean')
          return false
        if (
          (setting.type === 'input' || setting.type === 'color') &&
          typeof value !== 'string'
        ) {
          return false
        }
        if (
          setting.type === 'select' &&
          (typeof value !== 'string' ||
            !setting.options?.some((option) => option.value === value))
        ) {
          return false
        }
        if (setting.type === 'number') {
          if (typeof value !== 'number' || !Number.isFinite(value)) return false
          if (setting.min !== undefined && value < setting.min) return false
          if (setting.max !== undefined && value > setting.max) return false
        }
        accepted[key] = value
      }

      onConfigChange({ ...(config.config || {}), ...accepted })
      return true
    },
    [config.config, onConfigChange, widget],
  )

  // interval 是可选策略，并且只在可见、运行中的实例上计时。
  useEffect(() => {
    const policy = widget?.config.refreshPolicy
    if (
      policy?.mode !== 'interval' ||
      !policy.intervalSeconds ||
      !pageVisible ||
      !inViewport ||
      !isRunning
    ) {
      return
    }
    const timer = setInterval(requestRefresh, policy.intervalSeconds * 1000)
    return () => clearInterval(timer)
  }, [widget, pageVisible, inViewport, isRunning, requestRefresh])

  const previousPageVisibleRef = useRef(pageVisible)
  useEffect(() => {
    if (
      pageVisible &&
      !previousPageVisibleRef.current &&
      inViewport &&
      widget?.config.refreshPolicy?.refreshOnVisible !== false
    ) {
      requestRefresh()
    }
    previousPageVisibleRef.current = pageVisible
  }, [pageVisible, inViewport, requestRefresh, widget])

  // 仅站长/临时装所有者可启动；公开 Tapp 未运行时访客不得点开。
  const canControlLifecycle = useMemo(
    () => (tappInstance ? runtime.canControlLifecycle(tappInstance) : false),
    [runtime, tappInstance],
  )

  // 启动 Tapp（仅 canControlLifecycle）
  const handleStartTapp = useCallback(async () => {
    if (!widget || !canControlLifecycle) return
    try {
      await runtime.startTapp(widget.tappId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start Tapp')
    }
  }, [widget, runtime, canControlLifecycle])

  // 所有者挂载小组件时：若自己的装仍是 stopped，自动拉起（不帮访客启动站主已停的 Tapp）。
  const autoStartKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (isPreview) return
    if (!widget || !tappInstance || isRunning || loading || error) return
    if (!canControlLifecycle) return
    const key = widget.tappId
    if (autoStartKeyRef.current === key) return
    autoStartKeyRef.current = key

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        await runtime.startTapp(widget.tappId)
      } catch (err) {
        if (cancelled) return
        autoStartKeyRef.current = null
        setLoading(false)
        console.warn(
          '[TappWidget] auto-start failed:',
          err instanceof Error ? err.message : err,
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    widget,
    tappInstance,
    isRunning,
    loading,
    error,
    isPreview,
    runtime,
    canControlLifecycle,
  ])

  // 跳转到 Tapp 详情
  const handleGoToTapp = useCallback(() => {
    if (!widget) return
    navigate(`/tapp/detail/${widget.tappId}`)
  }, [widget, navigate])

  // 编辑模式下禁用指针事件，允许父级处理拖拽
  const pointerEventsStyle =
    isEditMode || isPreview ? { pointerEvents: 'none' as const } : {}

  // 加载中
  if (loading) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-white/50 dark:bg-neutral-900/50 rounded-xl"
        style={pointerEventsStyle}
      >
        <Spinner size="md" />
      </div>
    )
  }

  // 错误状态
  if (error || !widget || !tappInstance) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl"
        style={pointerEventsStyle}
      >
        <div className="text-red-500 dark:text-red-400 text-sm text-center px-4">
          {error || 'Widget not available'}
        </div>
      </div>
    )
  }

  // Tapp 未运行 - 显示启动提示（使用 Glass 风格）
  if (!isRunning || !code) {
    // 获取主题色
    const themeColor =
      tappInstance.manifest.themeColor ||
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() ||
      '#8b5cf6'

    // 图标样式
    const iconBgStyle = tappInstance.manifest.themeColor
      ? {
          background: `linear-gradient(to bottom right, ${tappInstance.manifest.themeColor}, ${tappInstance.manifest.themeColor}99)`,
        }
      : undefined
    const iconBgClass = tappInstance.manifest.themeColor
      ? 'bg-linear-to-br'
      : 'bg-linear-to-br from-indigo-500 to-purple-600'

    return (
      <WidgetShell
        containerRef={containerRef}
        padding={{ x: 16, y: 0 }}
        style={pointerEventsStyle}
        contentClassName="flex flex-col items-center justify-center"
        background={
          <>
            <GlowBackground
              color={themeColor}
              animLevel={anim.level}
              shouldAnimate={false}
              variant="single"
              size="md"
              opacity={0.12}
            />
            {/* 边框效果 */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10 pointer-events-none" />
          </>
        }
      >
        {/* 图标 */}
        <div
          className={`w-12 h-12 ${iconBgClass} rounded-lg flex items-center justify-center text-white shadow-lg relative overflow-hidden mb-3`}
          style={iconBgStyle}
        >
          <div className="absolute inset-0 bg-linear-to-br from-white/25 to-transparent" />
          <TappIcon
            icon={widget.config.icon || tappInstance.manifest.icon}
            iconSvg={tappInstance.manifest.iconSvg}
            name={
              widget.config.name ||
              resolveManifestText(tappInstance.manifest, locale).name
            }
            sizeClass="w-7 h-7"
            textSizeClass="text-2xl"
            className="relative z-10"
          />
        </div>

        {/* 名称 */}
        <div className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1 text-center">
          {widget.config.name}
        </div>

        {/* 提示 */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
          {canControlLifecycle
            ? '需要启动 Tapp 以显示'
            : 'Tapp 未启动'}
        </div>

        {/* 操作：仅所有者可启动；访客只能看详情，不能把站长已停的 Tapp 拉起来 */}
        {!isEditMode && (
          <div className="flex gap-2 justify-center">
            {canControlLifecycle && (
              <button
                onClick={handleStartTapp}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}, color-mix(in srgb, ${themeColor} 80%, black))`,
                }}
              >
                启动
              </button>
            )}
            <button
              onClick={handleGoToTapp}
              className="px-3 py-1.5 text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              详情
            </button>
          </div>
        )}
      </WidgetShell>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={pointerEventsStyle}
      data-no-ripple
    >
      {/* sandboxHostRef 常驻挂载作为视口观察目标；沙箱本身按 inViewport 挂/卸 */}
      <div ref={sandboxHostRef} className="w-full h-full">
        {inViewport && (
          <TappWidgetSandbox
            key={refreshGeneration}
            tappInstance={tappInstance}
            code={code}
            widgetId={widget.config.id || widget.id.split('.').pop() || ''}
            widgetProps={widgetProps}
            onError={(err: Error) => {
              setError(err.message)
            }}
            onInstanceSettingsChange={handleInstanceSettingsChange}
            onInvalidate={requestRefresh}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  )
}

export const TappWidgetComponent = memo(
  (props: TappWidgetProps) => {
    const anim = useAnimationLevel()

    if (props.isPreview) {
      return (
        <TappWidgetPreview
          tappWidgetId={props.tappWidgetId}
          config={props.config}
          animLevel={anim.level}
        />
      )
    }

    return <TappWidgetRuntime {...props} anim={anim} />
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，优化重渲染
    // 预览也必须比较具体 Tapp、尺寸和实例配置，不能复用另一应用的画面。
    if (prevProps.isPreview && nextProps.isPreview) {
      return (
        prevProps.tappWidgetId === nextProps.tappWidgetId &&
        prevProps.config.type === nextProps.config.type &&
        prevProps.config.size === nextProps.config.size &&
        JSON.stringify(prevProps.config.config) ===
          JSON.stringify(nextProps.config.config)
      )
    }
    // 非预览模式下进行更详细的比较
    return (
      prevProps.tappWidgetId === nextProps.tappWidgetId &&
      prevProps.isEditMode === nextProps.isEditMode &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.config.size === nextProps.config.size &&
      prevProps.config.type === nextProps.config.type &&
      JSON.stringify(prevProps.config.config) ===
        JSON.stringify(nextProps.config.config)
    )
  },
)

TappWidgetComponent.displayName = 'TappWidgetComponent'

export default TappWidgetComponent

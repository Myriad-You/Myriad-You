/**
 * 可视化编辑的网格小组件系统
 * 16x4 网格布局，支持拖拽编辑
 */

import type { TappSettingItem } from '../tapp/types'

import { FaChevronRight, FaCog, FaTimes } from '@lib/icons'
import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { useI18n } from '../contexts/I18nContext'
import { useHomeResizeObserver, useStaggerAnimation } from '../hooks/animation'
import {
  isExlight,
  isStandardAnimation,
  useAnimationLevel,
} from '../hooks/useAnimationLevel'
import { getPerformanceProfileSync } from '../hooks/usePerformanceProfile'
import { useDebouncedWindowSize } from '../hooks/useSharedEventListener'
import { preloadBuiltinWidgets } from './widgets/builtinWidgets'
import './WidgetGrid.css'

// ⚗️ 移动端检测 - 使用统一的性能检测系统
function getIsMobile(): boolean {
  return getPerformanceProfileSync().isMobile
}

// 🔧 性能优化：预生成常见网格尺寸的索引数组缓存
const gridIndicesCache = new Map<string, number[]>()
function getGridIndices(width: number, height: number): number[] {
  const key = `${width}x${height}`
  let indices = gridIndicesCache.get(key)
  if (!indices) {
    indices = Array.from({ length: width * height }, (_, i) => i)
    gridIndicesCache.set(key, indices)
  }
  return indices
}

// 小组件尺寸配置
export type WidgetSize =
  | '1x1'
  | '2x1'
  | '1x2'
  | '2x2'
  | '2x3'
  | '3x2'
  | '3x3'
  | '2x4'
  | '4x1'
  | '4x2'
  | '4x4'

// 小组件配置接口
export interface WidgetConfig {
  id: string
  type: string // 小组件类型标识
  size: WidgetSize
  position: { x: number; y: number } // 网格坐标 (0-15, 0-3)
  config?: any // 小组件特定配置
}

// 小组件组件Props
export interface WidgetComponentProps {
  config: WidgetConfig
  isEditMode: boolean
  isPreview?: boolean
  onConfigChange?: (newConfig: any) => void
}

// 网格尺寸常量
const GRID_WIDTH = 16
const GRID_HEIGHT = 4
// 移除 MOBILE_GRID_WIDTH，改为动态计算

// 尺寸到宽高的映射
const SIZE_TO_DIMENSIONS: Record<WidgetSize, { w: number; h: number }> = {
  '1x1': { w: 1, h: 1 },
  '2x1': { w: 2, h: 1 },
  '1x2': { w: 1, h: 2 },
  '2x2': { w: 2, h: 2 },
  '2x3': { w: 2, h: 3 },
  '3x2': { w: 3, h: 2 },
  '3x3': { w: 3, h: 3 },
  '2x4': { w: 2, h: 4 },
  '4x1': { w: 4, h: 1 },
  '4x2': { w: 4, h: 2 },
  '4x4': { w: 4, h: 4 },
}

function WidgetSettingsDialog({
  title,
  settings,
  value,
  onSave,
  onClose,
}: {
  title: string
  settings: TappSettingItem[]
  value: Record<string, unknown>
  onSave: (value: Record<string, unknown>) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
    ...Object.fromEntries(
      settings
        .filter((setting) => setting.defaultValue !== undefined)
        .map((setting) => [setting.key, setting.defaultValue]),
    ),
    ...value,
  }))

  const update = (key: string, next: unknown) =>
    setDraft((current) => ({ ...current, [key]: next }))

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 text-base font-semibold text-neutral-900 dark:text-white">
          {title}
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {settings.map((setting) => {
            const current = draft[setting.key] ?? setting.defaultValue
            return (
              <label key={setting.key} className="block space-y-1.5">
                <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  {setting.label}
                </span>
                {setting.description && (
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {setting.description}
                  </span>
                )}
                {setting.type === 'toggle' ? (
                  <input
                    type="checkbox"
                    checked={current === true}
                    onChange={(event) =>
                      update(setting.key, event.target.checked)
                    }
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                ) : setting.type === 'select' ? (
                  <select
                    value={String(current ?? '')}
                    onChange={(event) =>
                      update(setting.key, event.target.value)
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-800"
                  >
                    {setting.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      setting.type === 'number'
                        ? 'number'
                        : setting.type === 'color'
                          ? 'color'
                          : 'text'
                    }
                    value={String(current ?? '')}
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    placeholder={setting.placeholder}
                    onChange={(event) =>
                      update(
                        setting.key,
                        setting.type === 'number'
                          ? event.target.value === ''
                            ? null
                            : Number(event.target.value)
                          : event.target.value,
                      )
                    }
                    className={`${setting.type === 'color' ? 'h-10' : 'px-3 py-2'} w-full rounded-lg border border-black/10 bg-white text-sm dark:border-white/10 dark:bg-neutral-800`}
                  />
                )}
              </label>
            )
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Memoized Widget Item Component
const WidgetGridItem = React.memo(
  ({
    widget,
    widgetType,
    isEditMode,
    isHovered,
    onDragStart,
    onMouseEnter,
    onMouseLeave,
    onRemove,
    onResizeStart,
    gridWidth,
    gridHeight,
    cellWidth,
    cellHeight,
    onConfigChange,
    index = 0,
  }: {
    widget: WidgetConfig
    widgetType: WidgetType
    isEditMode: boolean
    isHovered: boolean
    onDragStart: (e: React.MouseEvent, id: string) => void
    onMouseEnter: (id: string) => void
    onMouseLeave: () => void
    onRemove: (id: string) => void
    onResizeStart: (
      e: React.MouseEvent | React.TouchEvent,
      id: string,
      direction?: 'se' | 's',
    ) => void
    gridWidth?: number
    gridHeight?: number
    cellWidth?: number
    cellHeight?: number
    onConfigChange?: (newConfig: any) => void
    /** 组件索引，用于计算递增延迟 */
    index?: number
  }) => {
    const anim = useAnimationLevel()
    const { t } = useI18n()
    const [showSettings, setShowSettings] = useState(false)
    const instanceSettings = widgetType.settings || []

    // 使用统一动画协调系统；exlight 模式直接显示且不进入调度队列。
    const animationsEnabled = !isExlight(anim)
    const { canAnimate, onComplete } = useStaggerAnimation({
      groupId: 'widget-grid',
      index: index || 0,
      baseDelay: 80,
      enabled: animationsEnabled,
    })

    const dim = SIZE_TO_DIMENSIONS[widget.size]
    const WidgetComponent = widgetType.component

    // 使用传入的网格尺寸或默认值
    const gw = gridWidth || GRID_WIDTH
    const gh = gridHeight || GRID_HEIGHT

    // 如果有像素级尺寸，优先使用
    const style: React.CSSProperties =
      cellWidth && cellHeight
        ? {
            left: widget.position.x * cellWidth,
            top: widget.position.y * cellHeight,
            width: dim.w * cellWidth,
            height: dim.h * cellHeight,
            zIndex: isHovered ? 20 : 10,
            willChange: isEditMode ? 'transform, left, top' : 'auto',
          }
        : {
            left: `${(widget.position.x / gw) * 100}%`,
            top: `${(widget.position.y / gh) * 100}%`,
            width: `${(dim.w / gw) * 100}%`,
            height: `${(dim.h / gh) * 100}%`,
            zIndex: isHovered ? 20 : 10,
            willChange: isEditMode ? 'transform, left, top' : 'auto',
          }

    // 检查是否支持调整大小
    const canResize =
      !widgetType.supportedSizes || widgetType.supportedSizes.length > 1

    // 低性能模式 / 低端设备：禁用 spring，改用轻量 tween
    const useLiteTransition =
      !anim.spring || !isStandardAnimation(anim)

    return (
      <motion.div
        className={`absolute ease-[cubic-bezier(0.25,1,0.5,1)] ${
          animationsEnabled ? 'transition-all duration-500' : 'transition-none'
        }`}
        style={style}
        initial={animationsEnabled ? { opacity: 0, scale: 0.9, y: 12 } : false}
        animate={
          !animationsEnabled || canAnimate
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.9, y: 12 }
        }
        exit={animationsEnabled ? { opacity: 0, scale: 0.9 } : undefined}
        onAnimationComplete={onComplete}
        transition={
          !animationsEnabled
            ? { duration: 0 }
            : useLiteTransition
              ? { type: 'tween', duration: 0.35 }
              : {
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                }
        }
      >
        <div className="relative h-full w-full p-1 group">
          <div
            className={`relative h-full w-full rounded-xl overflow-hidden transition-all ${
              isEditMode
                ? 'cursor-move ring-1 ring-transparent hover:ring-blue-400/50'
                : ''
            } ${isHovered && isEditMode ? 'ring-blue-400/50 shadow-lg' : ''}`}
            onMouseDown={(e) => onDragStart(e, widget.id)}
            onMouseEnter={() => isEditMode && onMouseEnter(widget.id)}
            onMouseLeave={onMouseLeave}
          >
            {/* 非报告类 lazy 小组件的 Suspense 兜底；ReportCard 已同步加载不会挂起 */}
            <Suspense fallback={null}>
              <WidgetComponent
                config={widget}
                isEditMode={isEditMode}
                onConfigChange={onConfigChange}
              />
            </Suspense>
          </div>

          {/* 删除按钮（编辑模式） */}
          {isEditMode && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(widget.id)
                }}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center shadow-md z-30 transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
                title={t.widgetGrid.deleteWidget}
                aria-label={t.widgetGrid.deleteWidget}
              >
                <FaTimes size={10} />
              </button>

              {instanceSettings.length > 0 && onConfigChange && (
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setShowSettings(true)
                  }}
                  className="absolute top-1.5 right-8 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-700/85 text-white opacity-0 shadow-md transition-all hover:scale-110 hover:bg-neutral-800 group-hover:opacity-100 z-30"
                  title={t.widgetGrid.widgetSettings}
                  aria-label={t.widgetGrid.widgetSettings}
                >
                  <FaCog size={10} />
                </button>
              )}

              {/* 调整大小手柄 - 明显的倒L型设计，触控时区域更大 */}
              {canResize && (
                <div
                  className={`absolute bottom-0 right-0 cursor-se-resize z-50 flex items-end justify-end transition-transform hover:scale-110 active:scale-95 group/resize touch-none ${
                    widget.size === '1x1'
                      ? 'w-8 h-8 p-0.5 md:w-6 md:h-6'
                      : 'w-14 h-14 p-2 md:w-12 md:h-12'
                  }`}
                  onMouseDown={(e) => onResizeStart(e, widget.id, 'se')}
                  onTouchStart={(e) => onResizeStart(e, widget.id, 'se')}
                >
                  {/* L 型条 - 适配主题色，1x1组件更小 */}
                  <div
                    className={`border-b-8 border-r-8 rounded-br-xl drop-shadow-[0_4px_4px_color-mix(in_srgb,var(--color-primary),transparent_70%)] opacity-60 group-hover/resize:opacity-100 transition-all duration-200 border-[color-mix(in_srgb,var(--color-primary),white_60%)] group-hover/resize:border-[color-mix(in_srgb,var(--color-primary),white_30%)] dark:border-[color-mix(in_srgb,var(--color-primary),black_60%)] dark:group-hover/resize:border-[color-mix(in_srgb,var(--color-primary),black_30%)] ${
                      widget.size === '1x1'
                        ? 'w-4 h-4 border-b-5 border-r-5'
                        : 'w-6 h-6'
                    }`}
                  />
                </div>
              )}
            </>
          )}
        </div>
        {showSettings && instanceSettings.length > 0 && onConfigChange && (
          <WidgetSettingsDialog
            title={`${widgetType.name} · ${t.widgetGrid.widgetSettings}`}
            settings={instanceSettings}
            value={(widget.config || {}) as Record<string, unknown>}
            onClose={() => setShowSettings(false)}
            onSave={(next) => {
              onConfigChange(next)
              setShowSettings(false)
            }}
          />
        )}
      </motion.div>
    )
  },
  (prev, next) => {
    return (
      prev.widget === next.widget &&
      prev.isEditMode === next.isEditMode &&
      prev.isHovered === next.isHovered &&
      prev.widgetType === next.widgetType &&
      prev.gridWidth === next.gridWidth &&
      prev.gridHeight === next.gridHeight &&
      prev.cellWidth === next.cellWidth &&
      prev.cellHeight === next.cellHeight &&
      prev.index === next.index
    )
  },
)

// 小组件库右侧滚动提示 - 独立组件，隔离滚动状态，
// 避免每次滚动都重渲染整个小组件库（含所有预览小组件）导致卡顿
const LibraryScrollHint = React.memo(
  ({
    scrollRef,
    availableWidgets,
  }: {
    scrollRef: React.RefObject<HTMLDivElement | null>
    availableWidgets: WidgetType[]
  }) => {
    const [canScrollRight, setCanScrollRight] = useState(false)
    // 用户一旦手动滑动过，本次编辑期间就不再提示
    const [hasScrolled, setHasScrolled] = useState(false)
    const rafRef = useRef<number | null>(null)

    const update = useCallback(() => {
      rafRef.current = null
      const el = scrollRef.current
      if (!el) return
      const hasOverflow = el.scrollWidth - el.clientWidth > 4
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      setCanScrollRight(hasOverflow && !atEnd)
      if (el.scrollLeft > 4) setHasScrolled(true)
    }, [scrollRef])

    useEffect(() => {
      const el = scrollRef.current
      if (!el) return

      const onScroll = () => {
        if (rafRef.current) return
        rafRef.current = requestAnimationFrame(update)
      }

      el.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', update)
      return () => {
        el.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', update)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }, [scrollRef, update])

    // 小组件列表内容变化时（如切换 1 行/2 行模式）重新计算是否溢出
    useEffect(() => {
      update()
    }, [availableWidgets, update])

    const visible = canScrollRight && !hasScrolled

    return (
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end pr-3 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <motion.div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-900/90 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
          animate={
            // 不可见时停止循环动画，避免编辑期间一直空跑 rAF
            visible ? { x: [0, 5, 0], scale: [1, 1.08, 1] } : { x: 0, scale: 1 }
          }
          transition={
            visible
              ? {
                  duration: 1.3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }
              : { duration: 0.2 }
          }
        >
          <FaChevronRight
            className="text-gray-500 dark:text-white/70"
            size={16}
          />
        </motion.div>
      </div>
    )
  },
)
LibraryScrollHint.displayName = 'LibraryScrollHint'

// 可用小组件类型定义
export interface WidgetType {
  id: string
  name: string
  defaultSize: WidgetSize
  component: React.ComponentType<WidgetComponentProps>
  supportedSizes?: WidgetSize[] // 支持的尺寸列表，如果未定义则支持所有尺寸
  settings?: TappSettingItem[] // Tapp Widget 每实例设置声明
}

// 将 widget id 转换为翻译键 (kebab-case -> camelCase)
function getWidgetTranslationKey(id: string): string {
  return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

interface WidgetGridProps {
  widgets: WidgetConfig[]
  availableWidgets: WidgetType[]
  onWidgetsChange?: (widgets: WidgetConfig[]) => void
  isEditMode: boolean
  onToggleEditMode: (isEdit: boolean) => void
  children?: React.ReactNode
  customGridColumns?: number // Optional prop to override responsive grid columns
  customGridRows?: number // Optional prop to override default grid rows
  libraryContainerClassName?: string
  libraryContentClassName?: string
  libraryStyle?: React.CSSProperties
  libraryAnimation?: {
    initial: any
    animate: any
    exit: any
  }
  autoHeight?: boolean
}

/**
 * 检查小组件位置是否与其他小组件冲突
 */
function checkCollision(
  widget: WidgetConfig,
  allWidgets: WidgetConfig[],
  gridWidth: number,
  gridHeight: number,
  excludeId?: string,
): boolean {
  const dim = SIZE_TO_DIMENSIONS[widget.size]
  const { x, y } = widget.position

  // 检查是否超出边界
  if (x < 0 || y < 0 || x + dim.w > gridWidth || y + dim.h > gridHeight) {
    return true
  }

  // 检查与其他小组件的重叠
  for (const other of allWidgets) {
    if (other.id === excludeId || other.id === widget.id) continue

    const otherDim = SIZE_TO_DIMENSIONS[other.size]
    const { x: ox, y: oy } = other.position

    // AABB 碰撞检测
    if (
      x < ox + otherDim.w &&
      x + dim.w > ox &&
      y < oy + otherDim.h &&
      y + dim.h > oy
    ) {
      return true
    }
  }

  return false
}

export default function WidgetGrid({
  widgets,
  availableWidgets,
  onWidgetsChange,
  isEditMode,
  onToggleEditMode,
  children,
  customGridColumns,
  customGridRows,
  libraryContainerClassName,
  libraryContentClassName,
  libraryStyle,
  libraryAnimation,
  autoHeight,
}: WidgetGridProps) {
  const { t } = useI18n()
  const [gridColumns, setGridColumns] = useState(
    customGridColumns || GRID_WIDTH,
  )
  // Only enable compact mode (auto-layout) if we are in responsive mode (no custom columns) AND width is small
  const isCompact = !customGridColumns && gridColumns < GRID_WIDTH
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 🔧 性能优化：缓存 gridRect 避免频繁调用 getBoundingClientRect
  const gridRectRef = useRef<DOMRect | null>(null)

  // 计算内容高度 (用于 autoHeight)
  const contentHeight = useMemo(() => {
    if (!autoHeight) return 0
    let maxY = 0
    widgets.forEach((w) => {
      const dim = SIZE_TO_DIMENSIONS[w.size]
      maxY = Math.max(maxY, w.position.y + dim.h)
    })
    return maxY
  }, [widgets, autoHeight])

  // 响应式布局检测 - 使用共享的防抖窗口尺寸
  const { width: windowWidth } = useDebouncedWindowSize(150)

  useEffect(() => {
    if (customGridColumns) {
      setGridColumns(customGridColumns)
      return
    }

    if (windowWidth < 640) {
      setGridColumns(4) // 手机
    } else if (windowWidth < 1024) {
      setGridColumns(8) // 平板
    } else {
      setGridColumns(16) // 桌面
    }
  }, [windowWidth, customGridColumns])

  // 紧凑模式布局计算 (自动重排)
  const compactLayout = useMemo(() => {
    if (!isCompact) return null

    // 按原始位置排序 (y 优先, 然后 x)
    const sortedWidgets = [...widgets].sort((a, b) => {
      if (a.position.y === b.position.y) return a.position.x - b.position.x
      return a.position.y - b.position.y
    })

    const occupied = new Set<string>()
    const newWidgets: WidgetConfig[] = []
    let maxY = 0

    const isOccupied = (x: number, y: number, w: number, h: number) => {
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
          if (occupied.has(`${x + i},${y + j}`)) return true
        }
      }
      return false
    }

    const markOccupied = (x: number, y: number, w: number, h: number) => {
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
          occupied.add(`${x + i},${y + j}`)
        }
      }
    }

    for (const widget of sortedWidgets) {
      const dim = SIZE_TO_DIMENSIONS[widget.size]
      // 限制宽度不超过当前网格列数
      const w = Math.min(dim.w, gridColumns)
      const h = dim.h

      // 寻找第一个可用位置
      let x = 0
      let y = 0
      let placed = false

      while (!placed) {
        if (x + w <= gridColumns && !isOccupied(x, y, w, h)) {
          markOccupied(x, y, w, h)
          newWidgets.push({
            ...widget,
            position: { x, y },
          })
          maxY = Math.max(maxY, y + h)
          placed = true
        } else {
          x++
          if (x >= gridColumns) {
            x = 0
            y++
          }
        }
        // 防止死循环
        if (y > 100) break
      }
    }

    return { widgets: newWidgets, height: Math.max(4, maxY) }
  }, [widgets, isCompact, gridColumns])

  const currentWidgets =
    isCompact && compactLayout ? compactLayout.widgets : widgets
  const currentGridWidth = gridColumns
  const currentGridHeight =
    isCompact && compactLayout
      ? compactLayout.height
      : autoHeight
        ? Math.max(customGridRows || 0, contentHeight)
        : customGridRows || GRID_HEIGHT

  // 计算像素级单元格尺寸 (仅在紧凑模式下使用)
  const cellWidth =
    isCompact && containerWidth ? containerWidth / gridColumns : undefined
  const cellHeight = cellWidth // 正方形单元格
  const totalPixelHeight =
    isCompact && cellHeight ? currentGridHeight * cellHeight : undefined

  const [draggedWidget, setDraggedWidget] = useState<{
    type: 'existing' | 'new'
    widgetId?: string
    widgetTypeId?: string
    offset: { x: number; y: number }
  } | null>(null)
  const [resizingWidget, setResizingWidget] = useState<{
    widgetId: string
    startPos: { x: number; y: number }
    startSize: WidgetSize
    direction?: 'se' | 's'
  } | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{
    x: number
    y: number
  } | null>(null)
  const [widgetHistory, setWidgetHistory] = useState<WidgetConfig[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null)
  const [dragCursorPosition, setDragCursorPosition] = useState<{
    x: number
    y: number
  } | null>(null)

  // 小组件库横向滚动 - ref 本身不触发重渲染，滚动状态由独立子组件管理，
  // 避免每次滚动都重渲染整个小组件库（含所有预览小组件）导致卡顿
  const libraryScrollRef = useRef<HTMLDivElement>(null)

  // 进入编辑模式：预热目录内全部类型（含报告壳 + 全 report-* 对应 face）
  useEffect(() => {
    if (!isEditMode) return
    void preloadBuiltinWidgets(availableWidgets.map((w) => w.id)).catch(
      () => {},
    )
  }, [isEditMode, availableWidgets])

  // RAF ref for drag handling
  const rafRef = useRef<number | null>(null)

  // 保存到历史记录
  const saveToHistory = useCallback(
    (newWidgets: WidgetConfig[]) => {
      const newHistory = widgetHistory.slice(0, historyIndex + 1)
      newHistory.push(newWidgets)
      // 限制历史记录数量为20
      if (newHistory.length > 20) {
        newHistory.shift()
      } else {
        setHistoryIndex(historyIndex + 1)
      }
      setWidgetHistory(newHistory)
    },
    [widgetHistory, historyIndex],
  )

  // 🔧 更新 gridRect 缓存（在拖拽开始时调用）
  const updateGridRectCache = useCallback(() => {
    if (containerRef.current) {
      gridRectRef.current = containerRef.current.getBoundingClientRect()
    }
  }, [])

  // 🆕 使用首页原子化 ResizeObserver
  const { observeHomeResize, unobserveHomeResize } = useHomeResizeObserver()

  // 计算网格单元格尺寸 - 使用 ResizeObserver 的 contentRect 避免强制重排
  const gridRef = useCallback(
    (node: HTMLDivElement | null) => {
      // 清理旧的 observer
      if (containerRef.current) {
        unobserveHomeResize(containerRef.current)
      }

      containerRef.current = node
      if (node) {
        // 使用首页原子化 ResizeObserver 监听宽度变化
        observeHomeResize(node, (entry) => {
          // 直接使用 contentRect.width，避免调用 getBoundingClientRect
          setContainerWidth(entry.contentRect.width)
          // 🔧 同时更新 gridRect 缓存（需要完整 rect）
          gridRectRef.current = node.getBoundingClientRect()
        })
      }
    },
    [observeHomeResize, unobserveHomeResize],
  )

  // 清理 ResizeObserver
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        unobserveHomeResize(containerRef.current)
      }
    }
  }, [unobserveHomeResize])

  // 开始拖拽现有小组件
  const handleWidgetDragStart = useCallback(
    (e: React.MouseEvent, widgetId: string) => {
      if (!isEditMode) return
      e.stopPropagation()
      e.preventDefault()

      const widget = widgets.find((w) => w.id === widgetId)
      if (!widget) return

      // 🔧 拖拽开始时更新 gridRect 缓存
      updateGridRectCache()

      // 立即设置光标位置
      setDragCursorPosition({ x: e.clientX, y: e.clientY })

      // 设置拖拽状态
      setDraggedWidget({
        type: 'existing',
        widgetId,
        offset: { x: 0, y: 0 }, // offset 现在不再使用
      })
    },
    [isEditMode, widgets, updateGridRectCache],
  )

  // 开始拖拽新小组件
  const handleNewWidgetDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, widgetTypeId: string) => {
      e.stopPropagation()
      e.preventDefault()

      // 🔧 拖拽开始时更新 gridRect 缓存
      updateGridRectCache()

      // 获取初始位置
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      // 立即设置光标位置
      setDragCursorPosition({ x: clientX, y: clientY })

      // 设置拖拽状态
      setDraggedWidget({
        type: 'new',
        widgetTypeId,
        offset: { x: 0, y: 0 },
      })
    },
    [updateGridRectCache],
  )

  // 开始调整大小
  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent,
      widgetId: string,
      direction: 'se' | 's' = 'se',
    ) => {
      if (!isEditMode) return
      e.stopPropagation()
      e.preventDefault()

      const widget = widgets.find((w) => w.id === widgetId)
      if (!widget) return

      // 🔧 调整大小开始时更新 gridRect 缓存
      updateGridRectCache()

      // 获取初始位置（支持鼠标和触控）
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      setResizingWidget({
        widgetId,
        startPos: { x: clientX, y: clientY },
        startSize: widget.size,
        direction,
      })
    },
    [isEditMode, widgets, updateGridRectCache],
  )

  // 调整大小移动
  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!resizingWidget) return

      if (rafRef.current) return

      rafRef.current = requestAnimationFrame(() => {
        // 🔧 使用缓存的 gridRect，避免在 RAF 回调中调用 getBoundingClientRect
        const gridRect = gridRectRef.current
        if (!gridRect) {
          rafRef.current = null
          return
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

        const cellWidth = gridRect.width / currentGridWidth
        const cellHeight = gridRect.height / currentGridHeight

        const widget = widgets.find((w) => w.id === resizingWidget.widgetId)
        if (!widget) {
          rafRef.current = null
          return
        }

        // Calculate new dimensions based on mouse position relative to widget top-left
        const widgetLeft = widget.position.x * cellWidth + gridRect.left
        const widgetTop = widget.position.y * cellHeight + gridRect.top

        const newWidthPx = clientX - widgetLeft
        const newHeightPx = clientY - widgetTop

        // Convert to grid units (float)
        let rawW = newWidthPx / cellWidth
        const rawH = newHeightPx / cellHeight

        // 如果是底部调整，锁定宽度
        if (resizingWidget.direction === 's') {
          rawW = SIZE_TO_DIMENSIONS[widget.size].w
        }

        // Find closest valid size
        let bestSize = widget.size
        let minDistance = Infinity

        // 获取该组件类型支持的尺寸列表
        const widgetType = availableWidgets.find((w) => w.id === widget.type)

        // 如果找不到组件类型定义，或者没有定义 supportedSizes，则不允许调整大小（锁定当前尺寸）
        // 这是一个安全措施，防止意外拉伸到不支持的尺寸
        if (!widgetType) {
          rafRef.current = null
          return
        }

        const supportedSizes =
          widgetType.supportedSizes ||
          (Object.keys(SIZE_TO_DIMENSIONS) as WidgetSize[])

        // 过滤出有效的尺寸
        const validSizes = supportedSizes.filter(
          (size) => SIZE_TO_DIMENSIONS[size],
        )

        for (const size of validSizes) {
          const dim = SIZE_TO_DIMENSIONS[size]

          // 如果是底部调整，只考虑宽度相同的尺寸
          if (
            resizingWidget.direction === 's' &&
            dim.w !== SIZE_TO_DIMENSIONS[widget.size].w
          ) {
            continue
          }

          // Calculate Euclidean distance in grid units
          const dist = (dim.w - rawW) ** 2 + (dim.h - rawH) ** 2

          if (dist < minDistance) {
            minDistance = dist
            bestSize = size
          }
        }

        if (bestSize !== widget.size) {
          const newWidget = { ...widget, size: bestSize }
          // Check collision excluding itself
          if (
            !checkCollision(
              newWidget,
              widgets,
              currentGridWidth,
              currentGridHeight,
              widget.id,
            )
          ) {
            const updatedWidgets = widgets.map((w) =>
              w.id === widget.id ? newWidget : w,
            )
            onWidgetsChange?.(updatedWidgets)
          }
        }

        rafRef.current = null
      })
    },
    [
      resizingWidget,
      widgets,
      currentGridWidth,
      currentGridHeight,
      onWidgetsChange,
      availableWidgets,
    ],
  )

  // 结束调整大小
  const handleResizeEnd = useCallback(() => {
    if (resizingWidget) {
      saveToHistory(widgets)
      setResizingWidget(null)
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [resizingWidget, widgets, saveToHistory])

  // 拖拽移动
  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggedWidget) return

      // Use requestAnimationFrame to throttle updates
      if (rafRef.current) {
        return
      }

      rafRef.current = requestAnimationFrame(() => {
        // 🔧 使用缓存的 gridRect，避免在 RAF 回调中调用 getBoundingClientRect
        // 注意：如果容器在滚动过程中位置变化，需要在滚动事件中更新缓存
        const gridRect = gridRectRef.current

        if (!gridRect) {
          rafRef.current = null
          return
        }

        // 获取鼠标/触摸位置
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

        // 更新光标位置（用于渲染跟随光标的预览）
        setDragCursorPosition({ x: clientX, y: clientY })

        // 计算单元格尺寸
        const cellWidth = gridRect.width / currentGridWidth
        const cellHeight = gridRect.height / currentGridHeight

        // 获取当前拖拽的小组件尺寸
        let size: WidgetSize = '1x1'
        if (draggedWidget.type === 'existing' && draggedWidget.widgetId) {
          const widget = widgets.find((w) => w.id === draggedWidget.widgetId)
          size = widget?.size || '1x1'
        } else if (draggedWidget.type === 'new' && draggedWidget.widgetTypeId) {
          const widgetType = availableWidgets.find(
            (w) => w.id === draggedWidget.widgetTypeId,
          )
          size = widgetType?.defaultSize || '1x1'
        }
        const dim = SIZE_TO_DIMENSIONS[size]

        // 计算鼠标在网格中的位置
        let mouseX = clientX - gridRect.left
        let mouseY = clientY - gridRect.top

        // 所有小组件都以中心点为参考
        // 减去小组件尺寸的一半，使光标位于中心
        mouseX -= (dim.w * cellWidth) / 2
        mouseY -= (dim.h * cellHeight) / 2

        // 转换为网格坐标
        let gridX = Math.floor(mouseX / cellWidth)
        let gridY = Math.floor(mouseY / cellHeight)

        // 确保小组件不会超出边界（考虑小组件尺寸）
        gridX = Math.max(0, Math.min(currentGridWidth - dim.w, gridX))
        gridY = Math.max(0, Math.min(currentGridHeight - dim.h, gridY))

        setHoveredCell((prev) => {
          if (prev?.x === gridX && prev?.y === gridY) return prev
          return { x: gridX, y: gridY }
        })

        rafRef.current = null
      })
    },
    [
      draggedWidget,
      widgets,
      availableWidgets,
      currentGridWidth,
      currentGridHeight,
    ],
  )

  // 结束拖拽
  const handleDragEnd = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (!draggedWidget || !hoveredCell) {
      setDraggedWidget(null)
      setHoveredCell(null)
      setDragCursorPosition(null)
      return
    }

    if (draggedWidget.type === 'existing' && draggedWidget.widgetId) {
      // 移动现有小组件
      const widget = widgets.find((w) => w.id === draggedWidget.widgetId)
      if (!widget) return

      const newWidget = {
        ...widget,
        position: hoveredCell,
      }

      // 检查碰撞
      // 注意：在移动端模式下，我们可能需要禁用拖拽或者使用不同的碰撞检测逻辑
      // 这里暂时保持原样，但使用 currentWidgets 进行检测可能不准确，因为 currentWidgets 是计算出来的
      // 如果在移动端拖拽，我们应该更新原始 widgets 的顺序？这比较复杂。
      // 建议：移动端禁用编辑模式
      if (
        !checkCollision(
          newWidget,
          widgets,
          currentGridWidth,
          currentGridHeight,
          widget.id,
        )
      ) {
        const updatedWidgets = widgets.map((w) =>
          w.id === widget.id ? newWidget : w,
        )
        onWidgetsChange?.(updatedWidgets)
        saveToHistory(updatedWidgets)
      }
    } else if (draggedWidget.type === 'new' && draggedWidget.widgetTypeId) {
      // 添加新小组件
      const widgetType = availableWidgets.find(
        (w) => w.id === draggedWidget.widgetTypeId,
      )
      if (!widgetType) return

      const newWidget: WidgetConfig = {
        id: `widget_${Date.now()}`,
        type: widgetType.id,
        size: widgetType.defaultSize,
        position: hoveredCell,
        config:
          widgetType.settings && widgetType.settings.length > 0
            ? Object.fromEntries(
                widgetType.settings
                  .filter((setting) => setting.defaultValue !== undefined)
                  .map((setting) => [setting.key, setting.defaultValue]),
              )
            : undefined,
      }

      // 为特定类型的小组件自动设置配置
      if (widgetType.id.startsWith('platform-')) {
        // 平台卡片小组件
        const platformId = widgetType.id.replace('platform-', '')
        newWidget.config = { platformId }
      } else if (widgetType.id.startsWith('report-')) {
        // 报告卡片小组件
        const platformId = widgetType.id.replace('report-', '')
        newWidget.config = { platformId }
      }

      // 检查碰撞
      if (
        !checkCollision(newWidget, widgets, currentGridWidth, currentGridHeight)
      ) {
        const newWidgets = [...widgets, newWidget]
        onWidgetsChange?.(newWidgets)
        saveToHistory(newWidgets)
      }
    }

    setDraggedWidget(null)
    setHoveredCell(null)
    setDragCursorPosition(null)
  }, [draggedWidget, hoveredCell, widgets, availableWidgets, onWidgetsChange])

  // 移除小组件
  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      const newWidgets = widgets.filter((w) => w.id !== widgetId)
      onWidgetsChange?.(newWidgets)
      // 添加到历史记录
      saveToHistory(newWidgets)
    },
    [widgets, onWidgetsChange],
  )

  // 撤销功能
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevWidgets = widgetHistory[historyIndex - 1]
      setHistoryIndex(historyIndex - 1)
      onWidgetsChange?.(prevWidgets)
    }
  }, [historyIndex, widgetHistory, onWidgetsChange])

  // 重做功能
  const handleRedo = useCallback(() => {
    if (historyIndex < widgetHistory.length - 1) {
      const nextWidgets = widgetHistory[historyIndex + 1]
      setHistoryIndex(historyIndex + 1)
      onWidgetsChange?.(nextWidgets)
    }
  }, [historyIndex, widgetHistory, onWidgetsChange])

  // 使用 ref 存储事件处理函数，避免每次状态变化时重新添加/移除事件监听器
  const handleDragMoveRef = useRef(handleDragMove)
  const handleDragEndRef = useRef(handleDragEnd)
  const handleResizeMoveRef = useRef(handleResizeMove)
  const handleResizeEndRef = useRef(handleResizeEnd)
  handleDragMoveRef.current = handleDragMove
  handleDragEndRef.current = handleDragEnd
  handleResizeMoveRef.current = handleResizeMove
  handleResizeEndRef.current = handleResizeEnd

  // 注册拖拽事件（鼠标和触屏）- 使用 ref 避免频繁重建监听器
  // ⚠️ 关键优化: 移动端禁用编辑模式,避免 passive: false 破坏滚动性能
  useEffect(() => {
    if (draggedWidget) {
      const isMobile = getIsMobile()
      const moveHandler = (e: MouseEvent | TouchEvent) =>
        handleDragMoveRef.current(e)
      const endHandler = () => handleDragEndRef.current()

      window.addEventListener('mousemove', moveHandler)
      window.addEventListener('mouseup', endHandler)

      // ⚠️ 移动端使用 passive: true 避免阻塞滚动
      // 这意味着在移动端拖拽时无法调用 preventDefault,但保证了滚动流畅性
      if (isMobile) {
        window.addEventListener('touchmove', moveHandler, { passive: true })
      } else {
        window.addEventListener('touchmove', moveHandler, { passive: false })
      }
      window.addEventListener('touchend', endHandler)
      window.addEventListener('touchcancel', endHandler)

      return () => {
        window.removeEventListener('mousemove', moveHandler)
        window.removeEventListener('mouseup', endHandler)
        window.removeEventListener('touchmove', moveHandler)
        window.removeEventListener('touchend', endHandler)
        window.removeEventListener('touchcancel', endHandler)
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
    }
  }, [draggedWidget]) // 只依赖 draggedWidget 是否存在

  // 注册调整大小事件 - 使用 ref 避免频繁重建监听器
  // ⚠️ 关键优化: 移动端使用 passive 监听避免阻塞滚动
  useEffect(() => {
    if (resizingWidget) {
      const isMobile = getIsMobile()
      const moveHandler = (e: MouseEvent | TouchEvent) =>
        handleResizeMoveRef.current(e)
      const endHandler = () => handleResizeEndRef.current()

      window.addEventListener('mousemove', moveHandler)
      window.addEventListener('mouseup', endHandler)

      // ⚠️ 移动端使用 passive: true 避免阻塞滚动
      if (isMobile) {
        window.addEventListener('touchmove', moveHandler, { passive: true })
      } else {
        window.addEventListener('touchmove', moveHandler, { passive: false })
      }
      window.addEventListener('touchend', endHandler)
      window.addEventListener('touchcancel', endHandler)

      return () => {
        window.removeEventListener('mousemove', moveHandler)
        window.removeEventListener('mouseup', endHandler)
        window.removeEventListener('touchmove', moveHandler)
        window.removeEventListener('touchend', endHandler)
        window.removeEventListener('touchcancel', endHandler)
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
    }
  }, [resizingWidget]) // 只依赖 resizingWidget 是否存在

  // 键盘快捷键支持（编辑模式）
  useEffect(() => {
    if (!isEditMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: 重做
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key === 'z') || e.key === 'y')
      ) {
        e.preventDefault()
        handleRedo()
      }
      // ESC: 取消编辑
      if (e.key === 'Escape') {
        onToggleEditMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode, handleUndo, handleRedo, onToggleEditMode])

  // 预览拖拽位置和组件信息
  const dragPreview = useMemo(() => {
    if (!draggedWidget || !hoveredCell) return null

    let size: WidgetSize = '1x1'
    let widgetType: WidgetType | undefined
    let widgetConfig: WidgetConfig | undefined

    if (draggedWidget.type === 'existing' && draggedWidget.widgetId) {
      const widget = widgets.find((w) => w.id === draggedWidget.widgetId)
      size = widget?.size || '1x1'
      widgetConfig = widget
      widgetType = availableWidgets.find((w) => w.id === widget?.type)
    } else if (draggedWidget.type === 'new' && draggedWidget.widgetTypeId) {
      widgetType = availableWidgets.find(
        (w) => w.id === draggedWidget.widgetTypeId,
      )
      size = widgetType?.defaultSize || '1x1'

      // 创建预览配置
      widgetConfig = {
        id: 'drag-preview',
        type: draggedWidget.widgetTypeId,
        size,
        position: hoveredCell,
        config: draggedWidget.widgetTypeId.startsWith('platform-')
          ? { platformId: draggedWidget.widgetTypeId.replace('platform-', '') }
          : draggedWidget.widgetTypeId.startsWith('report-')
            ? { platformId: draggedWidget.widgetTypeId.replace('report-', '') }
            : undefined,
      }
    }

    const dim = SIZE_TO_DIMENSIONS[size]
    const testWidget: WidgetConfig = {
      id: 'preview',
      type: widgetConfig?.type || '',
      size,
      position: hoveredCell,
    }

    const hasCollision = checkCollision(
      testWidget,
      widgets,
      currentGridWidth,
      currentGridHeight,
      draggedWidget.type === 'existing' ? draggedWidget.widgetId : undefined,
    )

    return {
      position: hoveredCell,
      size: dim,
      hasCollision,
      widgetType,
      widgetConfig,
    }
  }, [draggedWidget, hoveredCell, widgets, availableWidgets])

  // Memoize grid background
  const gridBackground = useMemo(() => {
    // 🔧 使用缓存的网格索引
    const indices = getGridIndices(currentGridWidth, currentGridHeight)
    return (
      <div
        className="widget-grid-background absolute inset-0 pointer-events-none z-0"
        style={{
          gridTemplateColumns: `repeat(${currentGridWidth}, 1fr)`,
          gridTemplateRows: `repeat(${currentGridHeight}, 1fr)`,
        }}
      >
        {indices.map((i) => (
          <div
            key={i}
            className="border border-gray-200/30 dark:border-white/5"
          />
        ))}
      </div>
    )
  }, [currentGridWidth, currentGridHeight])

  // 小组件库内容
  const libraryContent = (
    <motion.div
      initial={libraryAnimation?.initial || { y: '-100%' }}
      animate={libraryAnimation?.animate || { y: 0 }}
      exit={libraryAnimation?.exit || { y: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={
        libraryContainerClassName ||
        'fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-2xl'
      }
      style={libraryStyle}
    >
      <div className="w-full max-w-480 mx-auto">
        {/* 控制栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200/30 dark:border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <img
                src="/icons/widgets/library.webp"
                alt=""
                aria-hidden="true"
                className="h-5 w-5 object-contain"
                draggable={false}
                decoding="async"
              />
              <span className="font-bold">{t.widgetGrid.widgetLibrary}</span>
            </div>

            <div className="h-5 w-px bg-gray-300 dark:bg-white/10 mx-2" />

            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-undo="true"
              >
                <span className="text-sm font-bold">↶</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= widgetHistory.length - 1}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                data-redo="true"
              >
                <span className="text-sm font-bold">↷</span>
              </button>
            </div>
          </div>
        </div>

        {/* 组件列表 - 横向滚动 */}
        <div className="relative">
          <div
            ref={libraryScrollRef}
            className={
              libraryContentClassName ||
              'flex items-center gap-6 p-6 overflow-x-auto scrollbar-hide min-h-40'
            }
            onWheel={(e) => {
              if (libraryContentClassName) return
              // 只接管纯垂直滚轮手势（deltaX 恒为 0，鼠标滚轮特征）；
              // 只要带有 deltaX（触控板横滑及其惯性尾段都会带一点）就完全交给浏览器原生处理，
              // 否则会在惯性阶段跟原生横向滚动打架，造成内容位置概率性闪现
              if (e.deltaX !== 0 || e.deltaY === 0) return
              const el = e.currentTarget
              const maxScrollLeft = el.scrollWidth - el.clientWidth
              if (maxScrollLeft <= 0) return
              e.preventDefault()
              el.scrollLeft = Math.max(
                0,
                Math.min(maxScrollLeft, el.scrollLeft + e.deltaY),
              )
            }}
          >
            {availableWidgets.map((widgetType) => {
              const WidgetComponent = widgetType.component
              const dim = SIZE_TO_DIMENSIONS[widgetType.defaultSize]

              // 预览缩放比例
              const scale = 0.65
              // 模拟的标准单元格大小 (px)
              const baseSize = 90

              // 实际渲染尺寸
              const renderWidth = dim.w * baseSize
              const renderHeight = dim.h * baseSize

              // 占位尺寸 (缩小后)
              const wrapperWidth = renderWidth * scale
              const wrapperHeight = renderHeight * scale

              // 构造预览配置
              const previewConfig: WidgetConfig = {
                id: `preview-${widgetType.id}`,
                type: widgetType.id,
                size: widgetType.defaultSize,
                position: { x: 0, y: 0 },
                config: widgetType.id.startsWith('platform-')
                  ? { platformId: widgetType.id.replace('platform-', '') }
                  : widgetType.id.startsWith('report-')
                    ? { platformId: widgetType.id.replace('report-', '') }
                    : undefined,
              }

              const libraryLabel =
                (t.widgets as any)[getWidgetTranslationKey(widgetType.id)] ||
                widgetType.name
              const isLibrary1x1 = widgetType.defaultSize === '1x1'

              return (
                <motion.div
                  key={widgetType.id}
                  className={`relative group cursor-move shrink-0${isLibrary1x1 ? ' flex flex-col items-center' : ''}`}
                  style={
                    isLibrary1x1
                      ? { width: wrapperWidth }
                      : {
                          width: wrapperWidth,
                          height: wrapperHeight,
                        }
                  }
                  draggable
                  onMouseDown={(e: React.MouseEvent) =>
                    handleNewWidgetDragStart(e, widgetType.id)
                  }
                  onTouchStart={(e: React.TouchEvent) =>
                    handleNewWidgetDragStart(e, widgetType.id)
                  }
                  whileHover={{ scale: 1.05, zIndex: 10 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLibrary1x1 ? (
                    <>
                      {/* 1x1：预览框固定尺寸；名称放框外下方，避免内叠 tip 溢出 */}
                      <div
                        className="relative"
                        style={{
                          width: wrapperWidth,
                          height: wrapperHeight,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 origin-top-left pointer-events-none shadow-sm rounded-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
                          style={{
                            width: renderWidth,
                            height: renderHeight,
                            transform: `scale(${scale})`,
                          }}
                        >
                          <Suspense fallback={null}>
                            <WidgetComponent
                              config={previewConfig}
                              isEditMode={true}
                              isPreview={true}
                            />
                          </Suspense>
                        </div>
                        <div className="absolute inset-0 z-20 rounded-xl ring-1 ring-black/5 dark:ring-white/10 group-hover:ring-2 group-hover:ring-blue-500 transition-all bg-transparent" />
                      </div>
                      <div
                        className="mt-5 w-full px-0.5 text-center text-[10px] font-bold leading-tight text-gray-600 dark:text-gray-300 line-clamp-2 break-words pointer-events-none"
                        title={libraryLabel}
                      >
                        {libraryLabel}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 缩放容器 */}
                      <div
                        className="absolute top-0 left-0 origin-top-left pointer-events-none shadow-sm rounded-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
                        style={{
                          width: renderWidth,
                          height: renderHeight,
                          transform: `scale(${scale})`,
                        }}
                      >
                        <Suspense fallback={null}>
                          <WidgetComponent
                            config={previewConfig}
                            isEditMode={true}
                            isPreview={true}
                          />
                        </Suspense>
                      </div>

                      {/* 遮罩层 - 用于拖拽交互和高亮 */}
                      <div className="absolute inset-0 z-20 rounded-xl ring-1 ring-black/5 dark:ring-white/10 group-hover:ring-2 group-hover:ring-blue-500 transition-all bg-transparent" />

                      {/* 悬浮提示（非 1x1 维持原样） */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-white/90 dark:bg-neutral-900/90 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm border border-gray-200/50 dark:border-neutral-700/50">
                        {libraryLabel}
                      </div>
                    </>
                  )}
                </motion.div>
              )
            })}

            {/* 占位符，确保最后一个元素右侧有间距 */}
            <div className="w-2 shrink-0" />
          </div>

          {/* 右侧提示：还有更多小组件可滚动查看，一旦手动滑动过就不再出现 */}
          <LibraryScrollHint
            scrollRef={libraryScrollRef}
            availableWidgets={availableWidgets}
          />
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className={`flex flex-col gap-2 ${isCompact ? 'h-auto' : 'h-full'}`}>
      {/* 编辑模式：小组件库（顶部悬浮） */}
      {libraryContainerClassName ? (
        createPortal(
          <AnimatePresence>
            {isEditMode && !isCompact && libraryContent}
          </AnimatePresence>,
          document.body,
        )
      ) : (
        <AnimatePresence>
          {isEditMode && !isCompact && libraryContent}
        </AnimatePresence>
      )}

      {/* 网格区域 */}
      <div
        className={`relative w-full flex flex-col ${isCompact ? 'justify-start pb-20' : 'flex-1 justify-end min-h-0'}`}
      >
        {/* 插入 children (InfoBar) */}
        {children}

        <div
          ref={gridRef}
          className={`widget-grid-container relative w-full rounded-xl transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isEditMode ? 'edit-mode' : ''}`}
          style={
            isCompact && totalPixelHeight
              ? {
                  height: totalPixelHeight,
                  // 移除 aspectRatio，使用固定高度
                }
              : {
                  aspectRatio: `${currentGridWidth} / ${currentGridHeight}`,
                }
          }
        >
          {/* 背景网格线（编辑模式） */}
          {isEditMode && !isCompact && gridBackground}

          {/* 拖拽位置指示器 - 网格中的目标位置预览 */}
          {dragPreview && !isCompact && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className={`absolute z-20 rounded-xl transition-all pointer-events-none ${
                dragPreview.hasCollision
                  ? 'bg-red-500/10 ring-2 ring-red-500/50'
                  : 'bg-blue-500/10 ring-2 ring-blue-500/50'
              }`}
              style={{
                left: `${(dragPreview.position.x / currentGridWidth) * 100}%`,
                top: `${(dragPreview.position.y / currentGridHeight) * 100}%`,
                width: `${(dragPreview.size.w / currentGridWidth) * 100}%`,
                height: `${(dragPreview.size.h / currentGridHeight) * 100}%`,
              }}
            >
              {/* 状态提示 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${
                    dragPreview.hasCollision
                      ? 'bg-red-500/90 text-white'
                      : 'bg-blue-500/90 text-white'
                  }`}
                >
                  {dragPreview.hasCollision
                    ? t.widgetGrid.positionConflict
                    : t.widgetGrid.canPlace}
                </div>
              </div>
            </motion.div>
          )}

          {/* 小组件 */}
          <div className="absolute inset-0 z-10">
            {currentWidgets.map((widget, index) => {
              const widgetType = availableWidgets.find(
                (w) => w.id === widget.type,
              )
              if (!widgetType) return null

              // 处理小组件配置变更
              const handleConfigChange = (newConfig: any) => {
                // 只更新对应 widget 的 config 字段
                const newWidgets = widgets.map((w) =>
                  w.id === widget.id ? { ...w, config: newConfig } : w,
                )
                onWidgetsChange?.(newWidgets)
                saveToHistory(newWidgets)
              }

              return (
                <WidgetGridItem
                  key={widget.id}
                  widget={widget}
                  widgetType={widgetType}
                  isEditMode={isEditMode && !isCompact}
                  isHovered={hoveredWidgetId === widget.id}
                  onDragStart={handleWidgetDragStart}
                  onMouseEnter={setHoveredWidgetId}
                  onMouseLeave={() => setHoveredWidgetId(null)}
                  onRemove={handleRemoveWidget}
                  onResizeStart={handleResizeStart}
                  gridWidth={currentGridWidth}
                  gridHeight={currentGridHeight}
                  cellWidth={cellWidth}
                  cellHeight={cellHeight}
                  onConfigChange={handleConfigChange}
                  index={index}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* 跟随光标的真实小组件预览 */}
      <AnimatePresence>
        {draggedWidget &&
          dragCursorPosition &&
          dragPreview &&
          dragPreview.widgetType &&
          dragPreview.widgetConfig &&
          (() => {
            // 计算实际的网格单元格尺寸
            const gridRect = containerRef.current?.getBoundingClientRect()
            let cellWidth = 100
            let cellHeight = 100

            if (gridRect) {
              cellWidth = gridRect.width / currentGridWidth
              cellHeight = gridRect.height / currentGridHeight
            }

            // 计算预览的实际像素尺寸
            const previewWidth = dragPreview.size.w * cellWidth
            const previewHeight = dragPreview.size.h * cellHeight

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed pointer-events-none z-9999"
                style={{
                  left: `${dragCursorPosition.x}px`,
                  top: `${dragCursorPosition.y}px`,
                }}
              >
                {/* 小组件预览 - 中心对齐光标 */}
                <div
                  className={`absolute rounded-xl shadow-2xl ring-2 transition-all ${
                    dragPreview.hasCollision
                      ? 'ring-red-500/70'
                      : 'ring-blue-500/70'
                  }`}
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${previewWidth}px`,
                    height: `${previewHeight}px`,
                    opacity: 0.95,
                  }}
                >
                  <Suspense fallback={null}>
                    <dragPreview.widgetType.component
                      config={dragPreview.widgetConfig}
                      isEditMode={false}
                      isPreview={true}
                    />
                  </Suspense>
                </div>
              </motion.div>
            )
          })()}
      </AnimatePresence>
    </div>
  )
}

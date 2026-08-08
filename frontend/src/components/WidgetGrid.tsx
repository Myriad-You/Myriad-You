/**
 * 只读网格小组件系统(静态官网版)
 * 16x4 网格布局,渲染本地静态布局;无拖拽、无编辑模式、无布局保存。
 * 卡片点击通过 onWidgetClick 上抛(用于打开详情弹窗)。
 */

import { motionShim as motion } from '@lib/motionShim'
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { useHomeResizeObserver, useStaggerAnimation } from '../hooks/animation'
import {
  isExlight,
  isStandardAnimation,
  useAnimationLevel,
} from '../hooks/useAnimationLevel'
import { useDebouncedWindowSize } from '../hooks/useSharedEventListener'
import './WidgetGrid.css'

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

// 可用小组件类型定义
export interface WidgetType {
  id: string
  name: string
  defaultSize: WidgetSize
  component: React.ComponentType<WidgetComponentProps>
  supportedSizes?: WidgetSize[] // 支持的尺寸列表,如果未定义则支持所有尺寸
}

// Memoized Widget Item Component(只读:无拖拽/删除/调整大小)
const WidgetGridItem = React.memo(
  ({
    widget,
    widgetType,
    gridWidth,
    gridHeight,
    cellWidth,
    cellHeight,
    onClick,
    index = 0,
  }: {
    widget: WidgetConfig
    widgetType: WidgetType
    gridWidth?: number
    gridHeight?: number
    cellWidth?: number
    cellHeight?: number
    onClick?: (widget: WidgetConfig) => void
    /** 组件索引,用于计算递增延迟 */
    index?: number
  }) => {
    const anim = useAnimationLevel()

    // 使用统一动画协调系统;exlight 模式直接显示且不进入调度队列。
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

    // 如果有像素级尺寸,优先使用
    const style: React.CSSProperties =
      cellWidth && cellHeight
        ? {
            left: widget.position.x * cellWidth,
            top: widget.position.y * cellHeight,
            width: dim.w * cellWidth,
            height: dim.h * cellHeight,
            zIndex: 10,
          }
        : {
            left: `${(widget.position.x / gw) * 100}%`,
            top: `${(widget.position.y / gh) * 100}%`,
            width: `${(dim.w / gw) * 100}%`,
            height: `${(dim.h / gh) * 100}%`,
            zIndex: 10,
          }

    // 低性能模式 / 低端设备:禁用 spring,改用轻量 tween
    const useLiteTransition = !anim.spring || !isStandardAnimation(anim)

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
              onClick ? 'cursor-pointer' : ''
            }`}
            onClick={onClick ? () => onClick(widget) : undefined}
          >
            <Suspense fallback={null}>
              <WidgetComponent config={widget} isEditMode={false} />
            </Suspense>
          </div>
        </div>
      </motion.div>
    )
  },
  (prev, next) => {
    return (
      prev.widget === next.widget &&
      prev.widgetType === next.widgetType &&
      prev.gridWidth === next.gridWidth &&
      prev.gridHeight === next.gridHeight &&
      prev.cellWidth === next.cellWidth &&
      prev.cellHeight === next.cellHeight &&
      prev.index === next.index &&
      prev.onClick === next.onClick
    )
  },
)

interface WidgetGridProps {
  widgets: WidgetConfig[]
  availableWidgets: WidgetType[]
  /** 卡片点击回调(打开详情弹窗);不需要点击的卡片类型可在调用方过滤 */
  onWidgetClick?: (widget: WidgetConfig) => void
  children?: React.ReactNode
}

export default function WidgetGrid({
  widgets,
  availableWidgets,
  onWidgetClick,
  children,
}: WidgetGridProps) {
  const [gridColumns, setGridColumns] = useState(GRID_WIDTH)
  const isCompact = gridColumns < GRID_WIDTH
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // 响应式布局检测 - 使用共享的防抖窗口尺寸
  const { width: windowWidth } = useDebouncedWindowSize(150)

  useEffect(() => {
    if (windowWidth < 640) {
      setGridColumns(4) // 手机
    } else if (windowWidth < 1024) {
      setGridColumns(8) // 平板
    } else {
      setGridColumns(16) // 桌面
    }
  }, [windowWidth])

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
    isCompact && compactLayout ? compactLayout.height : GRID_HEIGHT

  // 计算像素级单元格尺寸 (仅在紧凑模式下使用)
  const cellWidth =
    isCompact && containerWidth ? containerWidth / gridColumns : undefined
  const cellHeight = cellWidth // 正方形单元格
  const totalPixelHeight =
    isCompact && cellHeight ? currentGridHeight * cellHeight : undefined

  // 🆕 使用首页原子化 ResizeObserver
  const { observeHomeResize, unobserveHomeResize } = useHomeResizeObserver()

  // 计算网格单元格尺寸 - 使用 ResizeObserver 的 contentRect 避免强制重排
  const gridRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      // 清理旧的 observer
      if (containerRef.current) {
        unobserveHomeResize(containerRef.current)
      }

      containerRef.current = node
      if (node) {
        // 使用首页原子化 ResizeObserver 监听宽度变化
        observeHomeResize(node, (entry) => {
          // 直接使用 contentRect.width,避免调用 getBoundingClientRect
          setContainerWidth(entry.contentRect.width)
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

  return (
    <div className={`flex flex-col gap-2 ${isCompact ? 'h-auto' : 'h-full'}`}>
      {/* 网格区域 */}
      <div
        className={`relative w-full flex flex-col ${isCompact ? 'justify-start pb-20' : 'flex-1 justify-end min-h-0'}`}
      >
        {/* 插入 children (InfoBar) */}
        {children}

        <div
          ref={gridRef}
          className="widget-grid-container relative w-full rounded-xl transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={
            isCompact && totalPixelHeight
              ? {
                  height: totalPixelHeight,
                }
              : {
                  aspectRatio: `${currentGridWidth} / ${currentGridHeight}`,
                }
          }
        >
          {/* 小组件 */}
          <div className="absolute inset-0 z-10">
            {currentWidgets.map((widget, index) => {
              const widgetType = availableWidgets.find(
                (w) => w.id === widget.type,
              )
              if (!widgetType) return null

              return (
                <WidgetGridItem
                  key={widget.id}
                  widget={widget}
                  widgetType={widgetType}
                  gridWidth={currentGridWidth}
                  gridHeight={currentGridHeight}
                  cellWidth={cellWidth}
                  cellHeight={cellHeight}
                  onClick={onWidgetClick}
                  index={index}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

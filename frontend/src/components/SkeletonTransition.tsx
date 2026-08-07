/**
 * 快速过渡组件：标签/筛选切换时的轻量交叉淡化
 *
 * 历史：本文件曾有完整骨架屏体系（SkeletonTransition 分相过渡、
 * LiquidGlassSkeleton 微粒消散骨架 + 80 粒子系统），全部零消费者，
 * 已于 2026-07 撤废——加载指示统一走 Spinner 组件（见 Spinner.tsx）。
 */

import type { ReactNode } from 'react'

import './Skeleton.css'

interface QuickTransitionProps {
  /** 是否处于过渡状态 */
  transitioning: boolean
  /** 内容 */
  children: ReactNode
  /** 自定义类名 */
  className?: string
}

export function QuickTransition({
  transitioning,
  children,
  className = '',
}: QuickTransitionProps) {
  return (
    <div
      className={`quick-transition ${transitioning ? 'transitioning' : 'visible'} ${className}`}
    >
      {children}
    </div>
  )
}

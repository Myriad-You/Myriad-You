/**
 * 折叠区域：高度 0 ↔ 内容高的动画容器。
 *
 * 模型（配合 SettingGroup 折叠组）：
 * - 外部间距 **永不** 随 open 变化（见 SettingGroup.css）
 * - 标题→内容 gap 写在子节点顶部 padding 上，随本区域高度一起动画
 * - grid-template-rows 0fr→1fr：无需测高，内容变高也不失准
 * - 收起播完再卸载；展开落定后放开 overflow（下拉/气泡可溢出）
 *
 * 状态机：
 *   open=true  → mount → collapsed(1帧) → entering → open
 *   open=false → collapsed →(播完) unmount
 *   首帧即 open：直接 open，避免整页加载时所有组一起「长出来」
 */

import type { ReactNode } from 'react'

import React, { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, SETTINGS_DURATION_MS } from './motion'
import './settings-motion.css'

type CollapseState = 'collapsed' | 'entering' | 'open'

export interface CollapseRegionProps {
  open: boolean
  children: ReactNode
  className?: string
}

export const CollapseRegion: React.FC<CollapseRegionProps> = ({
  open,
  children,
  className = '',
}) => {
  const [mounted, setMounted] = useState(open)
  const [state, setState] = useState<CollapseState>(open ? 'open' : 'collapsed')
  const isFirstRun = useRef(true)
  const timerRef = useRef<number | undefined>(undefined)
  const rafOuterRef = useRef<number | undefined>(undefined)
  const rafInnerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const first = isFirstRun.current
    isFirstRun.current = false

    window.clearTimeout(timerRef.current)
    if (rafOuterRef.current != null) cancelAnimationFrame(rafOuterRef.current)
    if (rafInnerRef.current != null) cancelAnimationFrame(rafInnerRef.current)

    const settleDelay = prefersReducedMotion() ? 0 : SETTINGS_DURATION_MS.slow

    if (open) {
      setMounted(true)
      if (first) {
        setState('open')
        return undefined
      }

      // 先以收起态画一帧，再切展开，否则两次 state 合成一帧、无过渡
      setState('collapsed')
      rafOuterRef.current = requestAnimationFrame(() => {
        rafInnerRef.current = requestAnimationFrame(() => {
          setState('entering')
          timerRef.current = window.setTimeout(() => {
            setState('open')
          }, settleDelay)
        })
      })
      return undefined
    }

    setState('collapsed')
    if (first) {
      setMounted(false)
      return undefined
    }
    timerRef.current = window.setTimeout(() => {
      setMounted(false)
    }, settleDelay)
    return undefined
  }, [open])

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current)
      if (rafOuterRef.current != null) cancelAnimationFrame(rafOuterRef.current)
      if (rafInnerRef.current != null) cancelAnimationFrame(rafInnerRef.current)
    },
    [],
  )

  if (!mounted) return null

  return (
    <div
      className={`sm-collapse${className ? ` ${className}` : ''}`}
      data-state={state}
      aria-hidden={!open || undefined}
    >
      <div className="sm-collapse-inner">{children}</div>
    </div>
  )
}

CollapseRegion.displayName = 'CollapseRegion'

export default CollapseRegion

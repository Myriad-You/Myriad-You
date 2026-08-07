/**
 * Tapp 页专用调度器 Hooks
 *
 * Tapp 页功能需求：
 * - Stagger: 卡片列表交错入场动画
 * - Visibility: 切换标签页时暂停/恢复动画
 *
 * @example
 * ```tsx
 * // 在 TappListPage.tsx 中
 * import { useTappScheduler, useTappStagger } from '@hooks/animation/pages/tapp';
 *
 * function TappListPage() {
 *   useTappScheduler();
 *   return <TappGrid />;
 * }
 *
 * function TappCard({ index }) {
 *   const { canAnimate, onComplete } = useTappStagger(index);
 *   return (
 *     <motion.div
 *       initial={{ opacity: 0, y: 10 }}
 *       animate={canAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
 *       onAnimationComplete={onComplete}
 *     />
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { coordinator } from '../coordinator'
import { isPageVisible, onVisibility, registerPageCleanup } from '../core'

import { AnimationPriority, AnimationState } from '../types'

const _PAGE_ID = 'tapp'
const BASE_STAGGER_DELAY = 60 // ms

let staggerIdCounter = 0

// ==================== 页面初始化 ====================

/**
 * Tapp 页调度器初始化
 *
 * 注意：startPage('tapp') 由 useRouteScheduler 统一调用
 */
export function useTappScheduler(): void {
  useEffect(() => {
    return () => {
      // 页面卸载时重置计数器
      staggerIdCounter = 0
    }
  }, [])
}

// ==================== Stagger Animation Hook ====================

interface TappStaggerResult {
  /** 是否可以开始动画 */
  canAnimate: boolean
  /** 动画完成回调 */
  onComplete: () => void
}

interface TappStaggerOptions {
  /** 卡片之间的交错延迟 */
  baseDelay?: number
  /** 是否启用入场动画 */
  enabled?: boolean
}

/**
 * Tapp 卡片交错动画 Hook
 *
 * @param index - 卡片在列表中的索引
 * @param options - 交错延迟和启用状态
 */
export function useTappStagger(
  index: number,
  options: TappStaggerOptions = {},
): TappStaggerResult {
  const { baseDelay = BASE_STAGGER_DELAY, enabled = true } = options

  // 生成稳定的动画 ID
  const idRef = useRef<string>('')
  if (!idRef.current) {
    idRef.current = `tapp-card-${++staggerIdCounter}`
  }
  const id = idRef.current

  // 延迟只由协调器执行；Motion 收到 READY 后立即播放。
  const coordinatedDelay = coordinator.getStaggerDelay(index, baseDelay)

  // 状态管理（使用 ref 避免不必要的渲染）
  const stateRef = useRef<AnimationState>(
    enabled ? AnimationState.WAITING : AnimationState.COMPLETED,
  )
  const scheduledRef = useRef(false)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const canAnimate =
    stateRef.current === AnimationState.READY ||
    stateRef.current === AnimationState.RUNNING ||
    stateRef.current === AnimationState.COMPLETED

  // 动画完成回调
  const onComplete = useCallback(() => {
    if (
      stateRef.current === AnimationState.READY ||
      stateRef.current === AnimationState.RUNNING
    ) {
      stateRef.current = AnimationState.COMPLETED
      coordinator.markCompleted(id)
    }
  }, [id])

  useEffect(() => {
    if (!enabled) {
      stateRef.current = AnimationState.COMPLETED
      forceUpdate()
      return
    }

    // 已经以无动画模式显示过的卡片不在偏好切换后重新播放入场。
    if (stateRef.current === AnimationState.COMPLETED) return

    // 避免重复调度
    if (scheduledRef.current) return
    scheduledRef.current = true

    // 调度动画
    coordinator.schedule({
      id,
      priority: AnimationPriority.COMPONENT,
      delay: coordinatedDelay,
    })

    // 订阅状态变化
    const unsubscribe = coordinator.subscribe(id, (state) => {
      stateRef.current = state

      if (state === AnimationState.READY) {
        stateRef.current = AnimationState.RUNNING
        coordinator.markRunning(id)
      }

      // 只在关键状态变化时触发渲染
      if (state === AnimationState.READY || state === AnimationState.SKIPPED) {
        forceUpdate()
      }
    })

    return () => {
      if (
        stateRef.current !== AnimationState.COMPLETED &&
        stateRef.current !== AnimationState.SKIPPED
      ) {
        coordinator.skip(id)
      }
      unsubscribe()
      scheduledRef.current = false
    }
  }, [coordinatedDelay, enabled, id])

  return { canAnimate, onComplete }
}

// ==================== Visibility Hook ====================

/**
 * Tapp 页面可见性 Hook
 * 用于在页面不可见时暂停动画
 */
export function useTappVisibility(): boolean {
  const [visible, setVisible] = useReducer(
    () => isPageVisible(),
    isPageVisible(),
  )

  useEffect(() => {
    return onVisibility(() => {
      setVisible()
    })
  }, [])

  return visible
}

// ==================== 清理 ====================

export function cleanupTapp(): void {
  staggerIdCounter = 0
}

// 自注册清理函数
registerPageCleanup(_PAGE_ID, cleanupTapp)

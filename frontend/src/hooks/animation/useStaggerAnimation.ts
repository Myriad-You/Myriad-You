/**
 * 交错动画 Hook
 *
 * 专门用于列表项等需要交错动画的场景
 * 协调器负责交错延迟，消费组件在获得 READY 后立即播放
 */

import { useEffect, useReducer, useRef } from 'react'
import { coordinator } from './coordinator'
import { AnimationPriority, AnimationState } from './types'

interface UseStaggerAnimationOptions {
  /** 分组ID */
  groupId: string
  /** 在组内的索引 */
  index: number
  /** 基础延迟(ms)，默认使用协调器配置 */
  baseDelay?: number
  /** 是否等待页面就绪 */
  waitForPage?: boolean
  /** 是否启用动画；禁用时直接显示且不占用协调器槽位 */
  enabled?: boolean
}

interface StaggerAnimationResult {
  /** 是否可以开始动画 */
  canAnimate: boolean
  /** 动画完成回调 */
  onComplete: () => void
}

let staggerIdCounter = 0

/**
 * 交错动画 Hook
 *
 * @example
 * ```tsx
 * function ListItem({ index }) {
 *   const { canAnimate } = useStaggerAnimation({
 *     groupId: 'list',
 *     index,
 *   });
 *
 *   return (
 *     <motion.div
 *       animate={canAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
 *     />
 *   );
 * }
 * ```
 *
 * 或使用 CSS 变量：
 * ```tsx
 * function ListItem({ index }) {
 *   const { canAnimate } = useStaggerAnimation({ groupId: 'list', index });
 *
 *   return (
 *     <div
 *       className={canAnimate ? 'animate-in' : ''}
 *     />
 *   );
 * }
 * ```
 */
export function useStaggerAnimation(
  options: UseStaggerAnimationOptions,
): StaggerAnimationResult {
  const {
    groupId,
    index,
    baseDelay,
    waitForPage = true,
    enabled = true,
  } = options

  // 生成稳定的 ID
  const idRef = useRef<string>('')
  if (!idRef.current) {
    idRef.current = `stagger-${groupId}-${++staggerIdCounter}`
  }
  const id = idRef.current

  // 延迟只由协调器执行，避免协调器与 Motion 重复等待。
  const coordinatedDelay = coordinator.getStaggerDelay(index, baseDelay)

  // 状态管理
  const stateRef = useRef<AnimationState>(
    enabled ? AnimationState.WAITING : AnimationState.COMPLETED,
  )
  // 🔧 优化：追踪是否已调度，避免重复调用 schedule
  const scheduledRef = useRef(false)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const canAnimate =
    stateRef.current === AnimationState.READY ||
    stateRef.current === AnimationState.RUNNING ||
    stateRef.current === AnimationState.COMPLETED

  useEffect(() => {
    if (!enabled) {
      stateRef.current = AnimationState.COMPLETED
      forceUpdate()
      return
    }

    // 已经直接显示的元素不在动画偏好改变后重新播放入场。
    if (stateRef.current === AnimationState.COMPLETED) return

    if (!waitForPage) {
      stateRef.current = AnimationState.READY
      forceUpdate()
      return
    }

    // 🔧 优化：如果已经调度过，跳过重复调度
    if (scheduledRef.current) {
      return
    }
    scheduledRef.current = true

    // 显式延迟仅提交一次；不再同时提交 groupId/index。
    coordinator.schedule({
      id,
      priority: AnimationPriority.ELEMENT,
      delay: coordinatedDelay,
    })

    // 订阅状态变化
    const unsubscribe = coordinator.subscribe(id, (state) => {
      const prevState = stateRef.current
      stateRef.current = state

      if (state === AnimationState.READY) {
        stateRef.current = AnimationState.RUNNING
        coordinator.markRunning(id)
      }

      if (prevState !== state && state === AnimationState.READY) {
        forceUpdate()
      }
    })

    return () => {
      unsubscribe()
      scheduledRef.current = false
      if (stateRef.current !== AnimationState.COMPLETED) {
        coordinator.skip(id)
        stateRef.current = AnimationState.SKIPPED
      }
    }
  }, [coordinatedDelay, enabled, id, waitForPage])

  const onComplete = () => {
    if (
      stateRef.current === AnimationState.READY ||
      stateRef.current === AnimationState.RUNNING
    ) {
      coordinator.markCompleted(id)
      stateRef.current = AnimationState.COMPLETED
    }
  }

  return {
    canAnimate,
    onComplete,
  }
}

export default useStaggerAnimation

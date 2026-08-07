/**
 * useLongPress - 长按检测 hook
 *
 * 从 AraelPanel 提取的全局长按触发逻辑：
 * - 检测 mouse/touch 长按事件
 * - 超过阈值后触发回调
 * - 移动超过 10px 自动取消
 * - 只认主键（左键 / 触控）；右键 / 中键不触发，避免抢系统菜单
 * - 自动排除交互元素
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface LongPressIndicator {
  x: number
  y: number
  active: boolean
}

const EXCLUDED_SELECTORS =
  '.arael-panel, input, textarea, button, a, [contenteditable], .tapp-window, .global-control-bar, .control-panel-overlay'

export function useLongPress(
  duration: number,
  onTrigger: () => void,
  enabled: boolean,
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const isPressing = useRef(false)
  const [indicator, setIndicator] = useState<LongPressIndicator>({
    x: 0,
    y: 0,
    active: false,
  })

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    isPressing.current = false
    startRef.current = null
    setIndicator((prev) => ({ ...prev, active: false }))
  }, [])

  const start = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!enabled) return
      // MouseEvent only: primary button (0). Right/middle must not open agent.
      if ('button' in e && e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest(EXCLUDED_SELECTORS)) return

      const point = 'touches' in e ? e.touches[0] : e
      startRef.current = { x: point.clientX, y: point.clientY }
      isPressing.current = true
      setIndicator({ x: point.clientX, y: point.clientY, active: true })

      timerRef.current = setTimeout(() => {
        if (isPressing.current) {
          setIndicator((prev) => ({ ...prev, active: false }))
          onTrigger()
          if (navigator.vibrate) navigator.vibrate(50)
        }
      }, duration)
    },
    [enabled, duration, onTrigger],
  )

  const checkMovement = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!startRef.current || !isPressing.current) return
      const point = 'touches' in e ? e.touches[0] : e
      const dx = Math.abs(point.clientX - startRef.current.x)
      const dy = Math.abs(point.clientY - startRef.current.y)
      if (dx > 10 || dy > 10) cancel()
    },
    [cancel],
  )

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => start(e)
    const handleTouchStart = (e: TouchEvent) => start(e)
    const handleUp = () => cancel()
    const handleMouseMove = (e: MouseEvent) => checkMovement(e)
    const handleTouchMove = (e: TouchEvent) => checkMovement(e)
    // Safety net: context menu (right-click / ctrl-click) always aborts
    const handleContextMenu = () => cancel()

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    })
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchend', handleUp)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchend', handleUp)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('contextmenu', handleContextMenu)
      cancel()
    }
  }, [start, cancel, checkMovement])

  return { indicator }
}

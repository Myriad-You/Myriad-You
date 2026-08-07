/**
 * 沙箱共享订阅 Hook
 *
 * 提取 TappPageSandbox 和 TappWidgetSandbox 之间的重复订阅逻辑：
 * - 主题变化监听
 * - 主色调变化监听
 * - 页面可见性联动（lifecycle:pause/resume）
 */

import type { TappBridge } from './TappBridge'
import { useEffect, useRef } from 'react'
import { isPageVisible, onVisibility } from '../../hooks/animation'

import {
  getPrimaryColor,
  subscribeToPrimaryColor,
} from '../../utils/colorSubscriber'
import { subscribeToTheme } from '../../utils/themeSubscriber'

/**
 * 管理沙箱公共事件订阅（主题、主色调、可见性）
 *
 * @param bridgeRef - TappBridge 引用
 * @param isReady - 沙箱是否就绪
 */
export function useSandboxSubscriptions(
  bridgeRef: React.RefObject<TappBridge | null>,
  isReady: boolean,
): void {
  const pageVisibleRef = useRef(isPageVisible())

  // 页面可见性联动：通知 iframe 冻结/恢复
  useEffect(() => {
    return onVisibility((visible) => {
      pageVisibleRef.current = visible
      if (isReady && bridgeRef.current) {
        bridgeRef.current.emit(
          visible ? 'lifecycle:resume' : 'lifecycle:pause',
          null,
        )
      }
    })
  }, [isReady, bridgeRef])

  // 主题变化监听
  useEffect(() => {
    if (!isReady) return
    return subscribeToTheme((isDark) => {
      const bridge = bridgeRef.current
      if (bridge) {
        bridge.emit('theme:change', isDark ? 'dark' : 'light')
      }
    })
  }, [isReady, bridgeRef])

  // 主色调变化监听（isReady 时立即发送当前颜色 + 订阅后续变化）
  useEffect(() => {
    if (!isReady) return

    const bridge = bridgeRef.current
    const currentColor = getPrimaryColor()
    if (bridge && currentColor) {
      bridge.emit('primaryColor:change', currentColor)
    }

    return subscribeToPrimaryColor((color) => {
      const bridge = bridgeRef.current
      if (bridge && color) {
        bridge.emit('primaryColor:change', color)
      }
    })
  }, [isReady, bridgeRef])
}

/**
 * IslandLayout — 控制岛移动端 / 桌面端双端布局容器
 *
 * - 移动端：顶部内联 (sm:hidden)
 * - 桌面端：底部浮动居中 (hidden sm:block fixed bottom-8)
 */

import { AnimatePresenceShim as AnimatePresence } from '@lib/motionShim'

export interface IslandLayoutProps {
  children: (variant: 'mobile' | 'desktop') => React.ReactNode
}

/**
 * 同时渲染移动端 + 桌面端控制岛，通过 CSS 切换可见性。
 * 传入 render function，自动传递 variant 参数。
 */
export function IslandLayout({ children }: IslandLayoutProps) {
  return (
    <>
      {/* 移动端顶部 */}
      <div className="sm:hidden w-full mb-4 touch-pan-y relative z-30">
        <AnimatePresence mode="wait">{children('mobile')}</AnimatePresence>
      </div>

      {/* 桌面端底部浮动 */}
      <div className="hidden sm:block fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <AnimatePresence mode="wait">{children('desktop')}</AnimatePresence>
      </div>
    </>
  )
}

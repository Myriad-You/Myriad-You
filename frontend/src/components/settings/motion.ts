/**
 * 设置页动效系统 —— JS 侧取值。
 *
 * CSS 侧的同一套令牌在 settings-motion.css，两边必须同步改：
 * 这里的秒数 = 那边的 --sm-dur-*，曲线数组 = 那边的 --sm-ease-*。
 *
 * 用途：
 * - framer-motion 的 transition（页面容器等仍走 JS 动画的地方）
 * - 卸载前的等待时长（CollapseRegion 这类「先播动画再卸载」的组件）
 */

/** 时长（秒）；毫秒版见 DURATION_MS */
export const SETTINGS_DURATION = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  slow: 0.32,
} as const

/** 时长（毫秒）：给 setTimeout / 卸载延迟用 */
export const SETTINGS_DURATION_MS = {
  instant: 90,
  fast: 140,
  base: 220,
  slow: 320,
} as const

/** 缓动（framer-motion 的三次贝塞尔控制点） */
export const SETTINGS_EASE = {
  standard: [0.32, 0.72, 0, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  emphasis: [0.22, 1, 0.36, 1],
  spring: [0.34, 1.4, 0.64, 1],
} as const

/** 页面级容器进入：设置页整体挂载时用一次 */
export const SETTINGS_PAGE_MOTION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: {
    duration: SETTINGS_DURATION.slow,
    ease: SETTINGS_EASE.enter,
  },
} as const

/** 侧边栏进入：与页面容器同时开始，位移方向改为水平 */
export const SETTINGS_SIDEBAR_MOTION = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: {
    duration: SETTINGS_DURATION.slow,
    ease: SETTINGS_EASE.enter,
    delay: 0.04,
  },
} as const

/**
 * 用户是否要求减少动效。
 * 需要「跳过等待时长」的地方（先播动画再卸载）用它把延迟归零，
 * 否则 reduced-motion 下动画已被压成 1ms，却仍要等 320ms 才卸载。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

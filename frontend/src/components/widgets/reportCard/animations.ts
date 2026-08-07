/** Static animation constants shared by platform faces. */

// 🔧 性能优化：预生成热力图网格索引，避免在渲染时调用 Array.from
export const HEATMAP_WEEKS = Array.from({ length: 12 }, (_, i) => i)
/** GitHub-style week columns: Sun–Sat (7 rows). */
export const HEATMAP_DAYS = Array.from({ length: 7 }, (_, i) => i)
export const LANES_ARRAY = Array.from({ length: 5 }, (_, i) => i)

// 弹幕动画 - 有限次数，配合调度器 duration=11000ms
export const DANMAKU_INITIAL = { x: '100%', opacity: 0 }
export const DANMAKU_ANIMATE = { x: '-100%', opacity: [0, 1, 1, 0] }
export function createDanmakuTransition(duration: number, delay: number) {
  return {
    repeat: 0, // 只运行一轮，由调度器控制重新播放
    duration,
    delay,
    ease: 'linear' as const,
  }
}

// 内容切换动画
export const CONTENT_FADE_INITIAL = { opacity: 0 }
export const CONTENT_FADE_ANIMATE = { opacity: 1 }
export const CONTENT_FADE_EXIT = { opacity: 0 }
export const CONTENT_FADE_TRANSITION = { duration: 0.5 }

export const CONTENT_SLIDE_INITIAL = { opacity: 0, y: 10 }
export const CONTENT_SLIDE_ANIMATE = { opacity: 1, y: 0 }
export const CONTENT_SLIDE_EXIT = { opacity: 0, y: -10 }
export const CONTENT_SLIDE_TRANSITION = { duration: 0.5 }

/**
 * 设置页强调色（--cfg-accent）
 *
 * 与页面 Hero 标题「自适应」色同源：从壁纸配色 CSS 变量出发，
 * 经 WCAG 对比度推导（deriveAdaptiveTitleColor），保证在明/暗主题下可读。
 *
 * 设置 CSS 应使用 var(--cfg-accent)，不要直接用 var(--color-primary)。
 */

import { deriveAdaptiveTitleColor } from './readableColor'
import { subscribeToTheme } from './themeSubscriber'

const CSS_VAR = '--cfg-accent'

/** 按当前主题重算并写入 --cfg-accent */
export function syncCfgAccentColor(): void {
  if (typeof document === 'undefined') return
  const isDark = document.documentElement.classList.contains('dark')
  const color = deriveAdaptiveTitleColor(isDark)
  document.documentElement.style.setProperty(CSS_VAR, color)
}

let started = false

/**
 * 启动一次：立即同步，并在主题切换时重算。
 * 壁纸取色变更走 applyColorPalette → syncCfgAccentColor。
 */
export function ensureCfgAccentSync(): void {
  if (started || typeof document === 'undefined') return
  started = true
  syncCfgAccentColor()
  subscribeToTheme(() => {
    syncCfgAccentColor()
  })
}

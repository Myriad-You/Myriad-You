/**
 * 表面主题 Hook —— 全站外观的状态与持久化中枢
 *
 * 两个维度均为「根属性 + CSS 令牌」纯 CSS 驱动，组件零订阅：
 * - 表面（surface）：写 html[data-surface]，theme.css 切换 --surface-* 令牌，
 *   驱动全站 .glass / .glass-surface / 浮动 chrome（玻璃 / 纯色 / 轻盈 / 描边）
 * - 光晕（glow）：写 html[data-glow]，GlowBackground.css 覆盖颜色（primary）
 *   或隐藏（none），默认 identity 用各组件身份色
 *
 * 本 hook 的 React 订阅仅存在于全站挂载点（SurfaceThemeApplier，渲染 null）。
 *
 * 静态官网版：无后端持久化，使用默认主题（glass / identity），
 * 保留「模块级全局状态 + 订阅者」范式，会话内修改即时生效。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { resyncWallpaperBlur } from '../utils/wallpaperState'

// ==================== 类型定义 ====================

export type WidgetSurface = 'glass' | 'solid' | 'flat' | 'outline' | 'liquid'
export type WidgetGlowMode = 'identity' | 'primary' | 'none'

interface WidgetThemeState {
  surface: WidgetSurface
  glow: WidgetGlowMode
}

type WidgetThemeListener = (state: WidgetThemeState) => void

// ==================== 选项配置 ====================

export const SURFACE_OPTIONS: readonly {
  id: WidgetSurface
  nameKey: string
  /** 预览色块类名（静态呈现该质感，见 theme.css .surface-swatch--*） */
  className: string
}[] = Object.freeze([
  { id: 'glass', nameKey: 'surfaceGlass', className: 'surface-swatch--glass' },
  {
    id: 'liquid',
    nameKey: 'surfaceLiquid',
    className: 'surface-swatch--liquid',
  },
  { id: 'solid', nameKey: 'surfaceSolid', className: 'surface-swatch--solid' },
  { id: 'flat', nameKey: 'surfaceFlat', className: 'surface-swatch--flat' },
  {
    id: 'outline',
    nameKey: 'surfaceOutline',
    className: 'surface-swatch--outline',
  },
])

export const GLOW_OPTIONS: readonly {
  id: WidgetGlowMode
  nameKey: string
}[] = Object.freeze([
  { id: 'identity', nameKey: 'glowIdentity' },
  { id: 'primary', nameKey: 'glowPrimary' },
  { id: 'none', nameKey: 'glowNone' },
])

const SURFACE_IDS = new Set<WidgetSurface>(SURFACE_OPTIONS.map((o) => o.id))

/**
 * 把当前主题写到根元素属性，之后全部由 CSS 驱动、无组件订阅：
 * - data-surface → theme.css 切换 --surface-* 令牌，驱动全站 .glass / .glass-surface
 * - data-glow    → GlowBackground.css 覆盖光晕颜色（primary）或隐藏（none）
 * 默认态（glass / identity）不落属性。
 */
function applyThemeToRoot(state: WidgetThemeState): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (state.surface === 'glass') {
    delete root.dataset.surface
  } else {
    root.dataset.surface = state.surface
  }
  if (state.glow === 'identity') {
    delete root.dataset.glow
  } else {
    root.dataset.glow = state.glow
  }
  // liquid 表面收敛壁纸基础模糊（壁纸清晰、玻璃负责模糊），
  // 切换表面时立即按当前主题重算，不等下一次壁纸应用
  resyncWallpaperBlur()
}

function isSurface(v: unknown): v is WidgetSurface {
  return typeof v === 'string' && SURFACE_IDS.has(v as WidgetSurface)
}

function isGlowMode(v: unknown): v is WidgetGlowMode {
  return v === 'identity' || v === 'primary' || v === 'none'
}

// ==================== 全局状态管理 ====================

const DEFAULT_THEME: WidgetThemeState = { surface: 'glass', glow: 'identity' }

let globalState: WidgetThemeState = { ...DEFAULT_THEME }
const listeners = new Set<WidgetThemeListener>()

function notifyListeners() {
  const state = { ...globalState }
  listeners.forEach((listener) => listener(state))
}

function updateGlobalState(updates: Partial<WidgetThemeState>) {
  const prev = globalState
  globalState = { ...globalState, ...updates }
  if (globalState.surface !== prev.surface || globalState.glow !== prev.glow) {
    applyThemeToRoot(globalState)
  }
  notifyListeners()
}

// 静态站点：主题固定为默认值，无需初始化

// ==================== Hook ====================

export function useWidgetTheme() {
  const [state, setState] = useState<WidgetThemeState>(globalState)
  const mountedRef = useRef(true)

  // 订阅全局状态
  useEffect(() => {
    mountedRef.current = true

    const listener: WidgetThemeListener = (newState) => {
      if (mountedRef.current) {
        setState(newState)
      }
    }

    listeners.add(listener)

    return () => {
      mountedRef.current = false
      listeners.delete(listener)
    }
  }, [])

  const setSurface = useCallback((surface: WidgetSurface) => {
    if (!isSurface(surface)) return
    updateGlobalState({ surface })
  }, [])

  const setGlowMode = useCallback((glow: WidgetGlowMode) => {
    if (!isGlowMode(glow)) return
    updateGlobalState({ glow })
  }, [])

  return {
    surface: state.surface,
    glow: state.glow,
    setSurface,
    setGlowMode,
  }
}

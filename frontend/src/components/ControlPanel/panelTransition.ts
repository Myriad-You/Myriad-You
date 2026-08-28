/**
 * 智能岛（GlobalControlPanel）展开/收起的唯一状态所有者。
 *
 * 对齐主线 frontend 的 panelTransition（issue #320）：
 * - 一条时间线、一个状态机：collapsed → opening → expanded → closing → collapsed。
 *   遮罩、内容可见性、动画类名全部从 phase 派生。
 * - 相位推进由真实的 transitionend 驱动（组件侧），本模块只负责用
 *   generation 作废过期回调：快速连点时旧动画的 settle 不会打断新动画。
 * 官网精简版没有通知 tab / 哨兵历史，状态比主线更窄。
 */

/** 与 `useAnimationLevel` 的 AnimationLevel 结构一致，此处避免反向依赖 React 模块。 */
export type PanelAnimationLevel = 'exlight' | 'light' | 'standard'

export type PanelPhase = 'collapsed' | 'opening' | 'expanded' | 'closing'

export interface PanelState {
  phase: PanelPhase
  /** 相位世代号：每次相位切换 +1，用于作废过期的 settle。 */
  generation: number
}

export const initialPanelState: PanelState = {
  phase: 'collapsed',
  generation: 0,
}

export type PanelAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'settle', generation: number }

export function panelReducer(
  state: PanelState,
  action: PanelAction,
): PanelState {
  switch (action.type) {
    case 'open': {
      if (state.phase === 'opening' || state.phase === 'expanded') {
        return state
      }
      return {
        phase: 'opening',
        generation: state.generation + 1,
      }
    }

    case 'close': {
      if (state.phase === 'collapsed' || state.phase === 'closing') {
        return state
      }
      return {
        phase: 'closing',
        generation: state.generation + 1,
      }
    }

    case 'settle': {
      if (action.generation !== state.generation) return state
      if (state.phase === 'opening') {
        return { phase: 'expanded', generation: state.generation + 1 }
      }
      if (state.phase === 'closing') {
        return { ...initialPanelState, generation: state.generation + 1 }
      }
      return state
    }

    default:
      return state
  }
}

/** 面板处于「展开」语义（含展开动画中）。 */
export function isPanelOpen(state: PanelState): boolean {
  return state.phase === 'opening' || state.phase === 'expanded'
}

/** 外壳 morph 进行中。 */
export function isPanelMorphing(state: PanelState): boolean {
  return state.phase === 'opening' || state.phase === 'closing'
}

/** 展开面板内容参与渲染并淡入（收起阶段交给 CSS 淡出）。 */
export function showsPanelContent(state: PanelState): boolean {
  return isPanelOpen(state)
}

/** 收缩态轮播内容可见（收起阶段即刻开始淡回，与外壳同一条时间线）。 */
export function showsDynamicContent(state: PanelState): boolean {
  return state.phase === 'collapsed' || state.phase === 'closing'
}

/** 遮罩可见。 */
export function showsOverlay(state: PanelState): boolean {
  return isPanelOpen(state)
}

/** 遮罩是否上模糊：仅在稳定展开态，morph 热路径不做全屏 backdrop-filter。 */
export function showsOverlayBlur(
  state: PanelState,
  motion: PanelMotionProfile,
): boolean {
  return motion.blurDuringMorph ? showsOverlay(state) : state.phase === 'expanded'
}

export interface PanelMotionProfile {
  /** 外壳 morph 时长（ms）。 */
  morphMs: number
  /** 是否做空间 morph；false = 仅 opacity 直切（reduced-motion / 最低档）。 */
  spatial: boolean
  /** morph 期间是否保留背景模糊（智能岛自身 + 全屏遮罩）。 */
  blurDuringMorph: boolean
}

/** 标准档 morph 时长；与 CSS 中的历史取值保持一致。 */
export const PANEL_MORPH_BASE_MS = 700

/** transitionend 迟迟不来时的兜底余量。 */
export const PANEL_SETTLE_SLACK_MS = 150

export function resolvePanelMotion(input: {
  level: PanelAnimationLevel
  reduceMotion: boolean
  isMobile: boolean
}): PanelMotionProfile {
  if (input.reduceMotion || input.level === 'exlight') {
    return { morphMs: 120, spatial: false, blurDuringMorph: false }
  }
  if (input.level === 'light') {
    return { morphMs: 420, spatial: true, blurDuringMorph: false }
  }
  return {
    morphMs: PANEL_MORPH_BASE_MS,
    spatial: true,
    blurDuringMorph: !input.isMobile,
  }
}

export function settleTimeoutMs(motion: PanelMotionProfile): number {
  return motion.morphMs + PANEL_SETTLE_SLACK_MS
}

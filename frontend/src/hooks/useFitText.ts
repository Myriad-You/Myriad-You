/**
 * 自适应文本引擎 —— 零配置的文本布局决策器
 *
 * 目标：小组件只声明「这是一段要放进有限空间的文本」，引擎决定其余一切：
 * 字号、行高、单行/换行/滚动，任意语言、任意长度都不溢出、不难看。
 *
 * ## 决策算法（badness 评分，取最小者）
 *
 * 借鉴 Knuth–Plass 断行算法的「立方惩罚」形状
 * (Knuth & Plass, "Breaking Paragraphs into Lines",
 * Software: Practice & Experience 11(11), 1981)：偏离理想字号越远，
 * 代价按三次方增长，前段几乎免费、末段急剧昂贵——小幅缩字优先于改变结构。
 *
 *   badness(候选) = sizeBadness + 结构惩罚
 *   sizeBadness   = ((ideal − s) / (ideal − min))³ × 100
 *   结构惩罚：换行 +10/额外行；滚动 +70；截断省略号 +1000（最后手段）
 *
 * 候选布局：
 *  1. 单行缩放：nowrap，二分收敛能放下的最大字号。
 *  2. 换行：仅当文本存在「干净断点」（空格/斜杠/CJK 标点等）。无断点的
 *     连续 CJK 强制单行，绝不词中断开。渲染时用 `text-wrap: balance`
 *     (CSS Text Module Level 4) 平衡各行长度，消除孤行与锯齿。
 *  3. 滚动 marquee：单行到最小字号仍放不下时的兜底，pause–scroll–pause
 *     往返（Apple HIG 自动滚动标签惯例）。低端设备 / 关闭循环动画 /
 *     prefers-reduced-motion 时降级为省略号。
 *
 * ## 行高模型
 *
 * 随字号增大而收紧（display 紧、正文松），取
 * lh(s) = clamp(1.08, 1.52 − 0.011·s, 1.42)，
 * 区间出自 Bringhurst《The Elements of Typographic Style》对 leading 的建议。
 *
 * ## 自动重测（组件无需传 deps）
 *
 * - ResizeObserver：观察元素自身与父容器宽度。网格入场时宽度未定，拿到真实
 *   宽度后自动重收敛；仅宽度变化触发，避免字号改变自身高度引起的回环。
 * - MutationObserver：观察文本内容（语言切换 / 数据更新）。
 * - document.fonts.ready：webfont 就位后字宽变化，补测一次。
 *
 * 性能：测量只在上述事件触发；单次二分 ≤8 次同步读写；低端设备仅挂载后
 * 补测一次且不启用滚动。
 */

import type { DependencyList, RefCallback } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { isReducedAnimation, useAnimationLevel } from './useAnimationLevel'

export type FitTextMode = 'single' | 'wrap' | 'marquee'

export interface FitTextOptions {
  /** 字号上限（理想值），px。缺省时取元素 CSS 计算字号——完全零配置 */
  max?: number
  /** 字号下限，px。缺省 max 的一半（不低于 10px 可读性硬下限） */
  min?: number
  /** 允许的最大行数；1 = 单行（默认） */
  maxLines?: number
  /** 换行时的可用高度上限，px。缺省按 maxLines × 行高推算 */
  boxHeight?: number
  /** 是否允许滚动兜底；默认 true。false 时超长退省略号 */
  marquee?: boolean
  /** 额外的重测依赖（引擎已自动观察内容/宽度/字体，一般无需传） */
  deps?: DependencyList
  /** 是否启用自适应；默认非低端设备启用 */
  enabled?: boolean
}

export interface FitTextResult {
  /** 绑定到文本元素的 ref */
  ref: RefCallback<HTMLElement>
  /** 决策出的字号，px */
  fontSize: number
  /** 决策出的行高倍率（字号→行高模型） */
  lineHeight: number
  /** 最终布局形态 */
  mode: FitTextMode
  /** 已到下限仍放不下（且无法滚动），需要省略号 */
  clamped: boolean
  /** 滚动位移距离，px（mode === 'marquee' 时有效） */
  marqueeDistance: number
  /** 滚动一个往返周期时长，s */
  marqueeDuration: number
}

interface FitState {
  fontSize: number
  lineHeight: number
  mode: FitTextMode
  clamped: boolean
  marqueeDistance: number
  marqueeDuration: number
}

const TOL = 0.5
/** 可读性硬下限：任何自动推导的 min 不低于此值 */
const ABS_MIN_FONT = 10
/** 每多一行的结构惩罚 */
const WRAP_LINE_PENALTY = 10
/** 滚动的结构惩罚（兜底手段，须明显优于把字缩到底才启用） */
const MARQUEE_PENALTY = 70
/** 截断省略号的惩罚（最后手段） */
const CLAMP_PENALTY = 1000
/** 滚动时的字号 = 理想值 × 该系数（滚动已解决容纳问题，无需缩很小） */
const MARQUEE_SIZE_RATIO = 0.9
/** 滚动速度，px/s */
const MARQUEE_SPEED = 28
/** 滚动终点向外多探出的余量，px */
const MARQUEE_LEAD_PX = 12
/**
 * 克制系数：往大长时目标占宽 ≤ 该比例，刻意留出呼吸留白，不无脑贴满。
 * 仅约束「生长」，溢出判定仍用全宽——已有的长文本不会因此被误判溢出。
 */
const RESTRAINT = 0.92
/**
 * 干净断点：空格 / 斜杠 / 连字符 / 软连字符(00AD) / 零宽空格(200B) /
 * CJK 标点（、。，！？：；・）。含其一则换行断在词间，视觉可接受；
 * 否则（连续 CJK 词）换行必然词中断开，禁止换行候选。
 */
const BREAK_RE = /[-\s/\u00AD\u200B\u3001\u3002\uFF0C\uFF01\uFF1F\uFF1A\uFF1B\u30FB]/

/** 字号→行高模型：display 紧、正文松（Bringhurst 建议区间） */
function lineHeightFor(fontSize: number): number {
  return Math.min(1.42, Math.max(1.08, 1.52 - 0.011 * fontSize))
}

/** 立方 badness：偏离理想字号的代价（Knuth–Plass 风格） */
function sizeBadness(s: number, min: number, ideal: number): number {
  if (ideal <= min) return 0
  const r = (ideal - s) / (ideal - min)
  return r * r * r * 100
}

/** 二分求满足 pred 的最大字号；先试上限，放得下直接用 */
function largestFitting(
  lo: number,
  hi: number,
  apply: (s: number) => void,
  fits: () => boolean,
): number {
  apply(hi)
  if (fits()) return hi
  let best = lo
  let l = lo
  let h = hi
  for (let i = 0; i < 8; i++) {
    const mid = (l + h) / 2
    apply(mid)
    if (fits()) {
      best = mid
      l = mid
    } else {
      h = mid
    }
  }
  apply(best)
  return best
}

export function useFitText(options: FitTextOptions): FitTextResult {
  const {
    max,
    min,
    maxLines = 1,
    boxHeight,
    marquee = true,
    deps = [],
    enabled,
  } = options

  const anim = useAnimationLevel()
  // 低性能模式 / 低端设备：仅挂载后补测一次，不持续挂 ResizeObserver
  const reducedPerf = isReducedAnimation(anim)
  const active = enabled ?? !reducedPerf
  const marqueeAllowed = marquee !== false && active && !!anim.loop

  const [node, setNode] = useState<HTMLElement | null>(null)
  const initialSize = max ?? 16
  const [state, setState] = useState<FitState>({
    fontSize: initialSize,
    lineHeight: lineHeightFor(initialSize),
    mode: 'single',
    clamped: false,
    marqueeDistance: 0,
    marqueeDuration: 0,
  })

  const ref = useCallback<RefCallback<HTMLElement>>((el) => setNode(el), [])

  // 零配置：未传 max 时首测捕获 CSS 计算字号作为理想值
  const idealRef = useRef<number | null>(null)
  // 上次布局完成时的宽度，供 RO 过滤「非宽度变化」避免回环
  const widthsRef = useRef({ el: -1, parent: -1 })
  // 最新参数供观察器回调读取
  const paramsRef = useRef({ max, min, maxLines, boxHeight, marqueeAllowed })
  paramsRef.current = { max, min, maxLines, boxHeight, marqueeAllowed }

  const runFit = useCallback((el: HTMLElement) => {
    const { max, min, maxLines, boxHeight, marqueeAllowed } = paramsRef.current

    // 尚未布局（宽度为 0）时不测量，等观察器拿到真实宽度再来
    if (el.clientWidth <= 0) return

    let ideal = max
    if (ideal == null) {
      if (idealRef.current == null) {
        const prev = el.style.fontSize
        el.style.fontSize = ''
        idealRef.current
          = Number.parseFloat(getComputedStyle(el).fontSize) || 16
        el.style.fontSize = prev
      }
      ideal = idealRef.current
    }
    const floor = Math.min(
      min ?? Math.max(ABS_MIN_FONT, Math.round(ideal * 0.5)),
      ideal,
    )

    // 滚动轨道测量期间归零，避免动画位移干扰读数
    const track = el.querySelector<HTMLElement>('[data-fittext-track]')
    const savedTrackCss = track?.style.cssText
    if (track) {
      track.style.animation = 'none'
      track.style.transform = 'none'
    }

    const text = (el.textContent ?? '').trim()
    const hasCleanBreak = BREAK_RE.test(text)

    // 真实内容宽度必须用 Range 测：scrollWidth = max(容器宽, 内容宽)，
    // 短文本会被容器钳位，无法与 0.92×容器宽 比较（恒为假 → 全部收敛到
    // 最小字号的恶性 bug）。Range rect 与容器 rect 同倍受祖先 transform
    // 缩放，入场动画期间比较比值依然正确。
    const range = document.createRange()
    const contentWidth = () => {
      range.selectNodeContents(el)
      return range.getBoundingClientRect().width
    }
    const boxWidth = () => el.getBoundingClientRect().width
    // 生长目标：占宽 ≤ RESTRAINT（留白）；溢出判定：全宽（不误伤长文本）
    const widthOkGrow = () => contentWidth() <= boxWidth() * RESTRAINT + TOL
    const widthOkHard = () => contentWidth() <= boxWidth() + TOL
    const applySize = (s: number) => {
      el.style.fontSize = `${s}px`
      el.style.lineHeight = String(lineHeightFor(s))
    }

    // —— 候选 1：单行缩放 ——
    el.style.whiteSpace = 'nowrap'
    const sSingle = largestFitting(floor, ideal, applySize, widthOkGrow)
    const singleFits = widthOkHard()
    let best = {
      mode: 'single' as FitTextMode,
      size: sSingle,
      badness:
        sizeBadness(sSingle, floor, ideal) + (singleFits ? 0 : CLAMP_PENALTY),
      clamped: !singleFits,
      distance: 0,
    }

    // —— 候选 2：干净断点换行（渲染时 text-wrap: balance 平衡行长）——
    if (maxLines > 1 && hasCleanBreak) {
      el.style.whiteSpace = 'normal'
      const heightOk = () => {
        const s = Number.parseFloat(el.style.fontSize)
        const limit
          = boxHeight && boxHeight > 0
            ? boxHeight
            : maxLines * s * lineHeightFor(s) + 2
        return el.scrollHeight <= limit + TOL
      }
      const bothOk = () => widthOkGrow() && heightOk()
      const sWrap = largestFitting(floor, ideal, applySize, bothOk)
      if (widthOkHard() && heightOk()) {
        const lines = Math.max(
          2,
          Math.round(el.scrollHeight / (sWrap * lineHeightFor(sWrap))),
        )
        const badness
          = sizeBadness(sWrap, floor, ideal) + WRAP_LINE_PENALTY * (lines - 1)
        if (badness < best.badness) {
          best = { mode: 'wrap', size: sWrap, badness, clamped: false, distance: 0 }
        }
      }
    }

    // —— 候选 3：滚动（单行到下限仍放不下才有意义）——
    if (!singleFits && marqueeAllowed) {
      const sMarquee = Math.max(floor, ideal * MARQUEE_SIZE_RATIO)
      const badness = sizeBadness(sMarquee, floor, ideal) + MARQUEE_PENALTY
      if (badness < best.badness) {
        el.style.whiteSpace = 'nowrap'
        applySize(sMarquee)
        const distance
          = Math.max(0, contentWidth() - boxWidth()) + MARQUEE_LEAD_PX
        best = { mode: 'marquee', size: sMarquee, badness, clamped: false, distance }
      }
    }

    if (track && savedTrackCss !== undefined) {
      track.style.cssText = savedTrackCss
    }

    // 应用最终布局，避免测量残留在下一次 React 渲染前闪烁
    el.style.whiteSpace = best.mode === 'wrap' ? 'normal' : 'nowrap'
    applySize(best.size)

    const next: FitState = {
      fontSize: best.size,
      lineHeight: lineHeightFor(best.size),
      mode: best.mode,
      clamped: best.clamped,
      marqueeDistance: best.mode === 'marquee' ? best.distance : 0,
      marqueeDuration:
        best.mode === 'marquee'
          ? Math.min(30, Math.max(6, (best.distance / MARQUEE_SPEED) * 2 + 3))
          : 0,
    }
    setState((prev) =>
      prev.fontSize === next.fontSize
      && prev.lineHeight === next.lineHeight
      && prev.mode === next.mode
      && prev.clamped === next.clamped
      && prev.marqueeDistance === next.marqueeDistance
      && prev.marqueeDuration === next.marqueeDuration
        ? prev
        : next,
    )

    widthsRef.current = {
      el: el.clientWidth,
      parent: el.parentElement?.clientWidth ?? -1,
    }
  }, [])

  useLayoutEffect(() => {
    if (!node) return

    // 低端设备：不挂观察器，仅下一帧补测一次
    if (!active) {
      const id = requestAnimationFrame(() => runFit(node))
      return () => cancelAnimationFrame(id)
    }

    runFit(node)

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => runFit(node))
    }

    // 宽度驱动重测：观察自身（flex 兄弟挤压）与父容器（网格入场/缩放）
    const ro = new ResizeObserver(() => {
      const prev = widthsRef.current
      const elW = node.clientWidth
      const parentW = node.parentElement?.clientWidth ?? -1
      if (Math.abs(elW - prev.el) < 1 && Math.abs(parentW - prev.parent) < 1) {
        return
      }
      schedule()
    })
    ro.observe(node)
    if (node.parentElement) ro.observe(node.parentElement)

    // 内容驱动重测：语言切换 / 数据更新
    const mo = new MutationObserver(schedule)
    mo.observe(node, { childList: true, characterData: true, subtree: true })

    // webfont 就位后字宽变化，补测一次
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) schedule()
    })

    return () => {
      cancelled = true
      ro.disconnect()
      mo.disconnect()
      cancelAnimationFrame(raf)
    }
    // deps 为调用方额外声明的依赖（一般无需）
  }, [node, active, max, min, maxLines, boxHeight, marqueeAllowed, runFit, ...deps])

  return {
    ref,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    mode: state.mode,
    clamped: state.clamped,
    marqueeDistance: state.marqueeDistance,
    marqueeDuration: state.marqueeDuration,
  }
}

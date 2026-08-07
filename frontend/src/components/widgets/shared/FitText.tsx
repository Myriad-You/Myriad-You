/**
 * 小组件文本布局原语
 *
 * - `FitText`：零配置自适应文本。引擎（useFitText）实测决策字号、行高与
 *   布局形态（单行缩放 / balance 换行 / 滚动 marquee），任意语言、任意长度
 *   不溢出。组件无需传测量依赖——引擎自动观察内容、宽度与字体加载。
 * - `ClampText`：纯 CSS 多行截断（line-clamp + 省略号），用于允许换行、
 *   超出即截断的说明性文本，无需测量。
 *
 * 两者都要求父级给出确定的可用宽度（flex 子项请配合 min-w-0）。
 */

import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useFitText } from '../../../hooks/useFitText'
import './FitText.css'

export interface FitTextProps {
  children: ReactNode
  /** 字号上限（理想值），px。缺省取元素 CSS 计算字号——完全零配置 */
  max?: number
  /** 字号下限，px。缺省 max 的一半（不低于 10px 可读性硬下限） */
  min?: number
  /** 最大行数，1 = 单行（默认）。仅有干净断点的文本会换行，CJK 绝不词中断开 */
  maxLines?: number
  /** 换行时的可用高度上限，px。主视觉标题建议传（如列高的一部分） */
  boxHeight?: number
  /** 允许滚动兜底，默认 true。false 时超长退省略号 */
  marquee?: boolean
  /** 额外重测依赖（引擎已自动观察内容/宽度/字体，一般无需传） */
  deps?: unknown[]
  /** 是否启用自适应（低端设备默认关闭持续观察） */
  enabled?: boolean
  /** 行高覆盖；缺省用引擎的字号→行高模型（大字紧、小字松） */
  lineHeight?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
  /** 无障碍/悬浮提示；截断或滚动时自动回退为完整文本 */
  title?: string
  align?: CSSProperties['textAlign']
}

export function FitText({
  children,
  max,
  min,
  maxLines = 1,
  boxHeight,
  marquee = true,
  deps,
  enabled,
  lineHeight,
  as: Tag = 'span',
  className,
  style,
  title,
  align,
}: FitTextProps) {
  const fit = useFitText({ max, min, maxLines, boxHeight, marquee, deps, enabled })

  // 引擎决定布局形态：换行时用 text-wrap: balance 平衡行长（CSS Text L4），
  // 单行/滚动时 nowrap；省略号只在滚动不可用且已到下限时出现。
  const layout: CSSProperties
    = fit.mode === 'wrap'
      ? {
          display: 'block',
          whiteSpace: 'normal',
          overflow: 'hidden',
          maxHeight: boxHeight ? `${boxHeight}px` : undefined,
          ...({ textWrap: 'balance' } as CSSProperties),
        }
      : {
          display: 'block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: fit.clamped ? 'ellipsis' : 'clip',
        }

  const fullText = typeof children === 'string' ? children : undefined
  const hoverTitle
    = fit.clamped || fit.mode === 'marquee' ? fullText ?? title : title

  return (
    <Tag
      ref={fit.ref}
      className={className}
      title={hoverTitle}
      style={{
        ...layout,
        minWidth: 0,
        maxWidth: '100%',
        fontSize: `${fit.fontSize}px`,
        lineHeight: lineHeight ?? fit.lineHeight,
        textAlign: align,
        ...style,
      }}
    >
      {fit.mode === 'marquee'
        ? (
            <span
              data-fittext-track
              style={
                {
                  '--ft-shift': `${-fit.marqueeDistance}px`,
                  '--ft-duration': `${fit.marqueeDuration}s`,
                } as CSSProperties
              }
            >
              {children}
            </span>
          )
        : children}
    </Tag>
  )
}

export interface ClampTextProps {
  children: ReactNode
  /** 最大行数，默认 2 */
  lines?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
  title?: string
}

export function ClampText({
  children,
  lines = 2,
  as: Tag = 'span',
  className,
  style,
  title,
}: ClampTextProps) {
  return (
    <Tag
      className={className}
      title={title}
      style={{
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: lines,
        overflow: 'hidden',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

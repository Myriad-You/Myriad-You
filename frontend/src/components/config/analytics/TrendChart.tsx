/**
 * 每日趋势：浏览量柱 + 独立访客折线
 *
 * - 单一坐标轴（两个序列都是「次数」，不做双轴，避免编造相关性）
 * - 序列身份靠形状（柱 vs 线）+ 图例 + 表格，不靠色相；访客线走中性去强调色
 * - 悬停 / 键盘左右键读同一份数值；另有表格视图，数值不被 tooltip 独占
 * - 刷新时保留上一帧（降透明度），不闪骨架屏
 */

import { LuBarChart3, LuList } from '@lib/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../contexts/I18nContext'
import { SegmentedControl } from '../../settings'
import { formatCount, formatDuration, niceAxis, shortDay } from './format'

export interface TrendPoint {
  day: string
  /** 柱系列（访客统计 = 浏览量；AI 用量 = 调用次数） */
  views: number
  /** 折线系列（访客统计 = 独立访客；AI 用量 = tokens） */
  visitors: number
  engagementMs?: number
}

/** 可复用图例 / 表格 / a11y 文案（默认走访客统计 i18n） */
export interface TrendChartSeriesLabels {
  primary: string
  secondary: string
  chartAria: string
  tableDay?: string
  /** 第三列（停留）；AI 用量等场景传 false 隐藏 */
  showEngagement?: boolean
  engagement?: string
}

interface TrendChartProps {
  points: TrendPoint[]
  /** 刷新中：保留当前渲染并降透明度 */
  refreshing?: boolean
  numberLocale: string
  /** 覆盖默认「浏览量 / 独立访客」文案，便于 AI 用量等复用 */
  seriesLabels?: TrendChartSeriesLabels
}

/** 绘图区几何（px，实测宽度后按像素排版，保证发丝线与柱宽不被缩放糊掉） */
const PLOT_H = 132
/** 折线峰值端点 + 描边环的留白 */
const TOP_PAD = 10
/** x 轴日期带 */
const AXIS_H = 18
/** y 轴刻度文字 */
const GUTTER_L = 38
/** 右侧留白：给折线末端的直接标注腾地方 */
const GUTTER_R = 34
const BAR_MAX_W = 22
const BAR_GAP = 3
/** 悬停点半径（只在读数时出现） */
const DOT_R = 3
/** 末端标注与最后一根柱之间的间距 */
const END_LABEL_GAP = 14
/** 日期标签的最小可读间距 */
const LABEL_MIN_W = 36
/** 读数与所读那根柱之间的水平间距 */
const TIP_OFFSET = 12

const SVG_H = TOP_PAD + PLOT_H + AXIS_H

/** 保留两位小数，别把 SVG 塞满长浮点 */
const px = (n: number): number => Math.round(n * 100) / 100

/** 顶部圆角、底部与基线齐平的柱体 */
function columnPath(x: number, w: number, y: number, baseY: number): string {
  const h = baseY - y
  if (h <= 0.5) return ''
  const r = Math.min(4, w / 2, h)
  const inner = w - r * 2
  return [
    `M${px(x)} ${px(baseY)}`,
    `V${px(y + r)}`,
    `a${px(r)} ${px(r)} 0 0 1 ${px(r)} ${px(-r)}`,
    `h${px(inner)}`,
    `a${px(r)} ${px(r)} 0 0 1 ${px(r)} ${px(r)}`,
    `V${px(baseY)}`,
    'Z',
  ].join('')
}

/**
 * 容器实测宽度（无 ResizeObserver 时退化为一次 clientWidth）。
 *
 * 用回调 ref 而不是 ref 对象：图表↔表格切换会把绘图容器卸载重挂，
 * 只在挂载时观测一次的话，观测对象会留在已卸载的旧节点上，
 * 之后容器变窄再也收不到通知，SVG 会顶着旧宽度溢出。
 */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [node, setNode] = useState<T | null>(null)
  const [width, setWidth] = useState(0)

  const attach = useCallback((el: T | null) => {
    ref.current = el
    setNode(el)
  }, [])

  useEffect(() => {
    if (!node) return
    setWidth(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0)
      setWidth((prev) => (prev === next ? prev : next))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return [attach, width, ref] as const
}

type ViewMode = 'chart' | 'table'

export const TrendChart: React.FC<TrendChartProps> = ({
  points,
  refreshing = false,
  numberLocale,
  seriesLabels,
}) => {
  const { t } = useI18n()
  const a = t.config.analytics
  const primaryLabel = seriesLabels?.primary ?? a.legendViews
  const secondaryLabel = seriesLabels?.secondary ?? a.legendVisitors
  const chartAria = seriesLabels?.chartAria ?? a.dailyChartAria
  const tableDayLabel = seriesLabels?.tableDay ?? a.tableDay
  const showEngagement = seriesLabels?.showEngagement !== false
  const engagementLabel = seriesLabels?.engagement ?? a.tableEngagement
  const [attachPlot, width, wrapRef] = useMeasuredWidth<HTMLDivElement>()
  const [view, setView] = useState<ViewMode>('chart')
  const [active, setActive] = useState<number | null>(null)

  const count = formatCount
  const axis = useMemo(
    () =>
      niceAxis(
        Math.max(
          0,
          ...points.map((p) => Math.max(p.views, p.visitors)),
        ),
      ),
    [points],
  )

  const plotW = Math.max(0, width - GUTTER_L - GUTTER_R)
  const slot = points.length > 0 ? plotW / points.length : 0
  const barW = Math.max(3, Math.min(BAR_MAX_W, slot - BAR_GAP))
  const baseY = TOP_PAD + PLOT_H
  const yOf = useCallback(
    (v: number) => baseY - (Math.max(0, v) / axis.max) * PLOT_H,
    [axis.max, baseY],
  )
  const xOf = useCallback(
    (i: number) => GUTTER_L + slot * i + slot / 2,
    [slot],
  )

  /** 日期标签抽稀：从末尾往前留，最后一天永远有标签 */
  const labelEvery = Math.max(
    1,
    Math.ceil((points.length * LABEL_MIN_W) / Math.max(1, plotW)),
  )

  const linePoints = useMemo(
    () =>
      points
        .map((p, i) => `${px(xOf(i))},${px(yOf(p.visitors))}`)
        .join(' '),
    [points, xOf, yOf],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (points.length === 0) return
      const last = points.length - 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        setActive((prev) => {
          if (prev == null) return dir > 0 ? 0 : last
          return Math.min(last, Math.max(0, prev + dir))
        })
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setActive(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActive(last)
      } else if (e.key === 'Escape') {
        setActive(null)
      }
    },
    [points.length],
  )

  /** clientX → 最近日索引（触控滑动 / 鼠标横扫共用） */
  const indexFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = wrapRef.current
      if (!el || points.length === 0 || width <= 0 || slot <= 0) return null
      const rect = el.getBoundingClientRect()
      const rel = clientX - rect.left - GUTTER_L
      if (rel < -slot * 0.25 || rel > plotW + slot * 0.25) return null
      return Math.min(
        points.length - 1,
        Math.max(0, Math.floor(rel / slot)),
      )
    },
    [points.length, width, slot, plotW],
  )

  const scrubTo = useCallback(
    (clientX: number) => {
      const i = indexFromClientX(clientX)
      if (i != null) setActive(i)
    },
    [indexFromClientX],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 捕获后 touch 滑动不会滚走页面
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      scrubTo(e.clientX)
    },
    [scrubTo],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 鼠标悬停即可读；触控 / 按下后横扫
      if (
        e.pointerType === 'mouse' ||
        e.buttons > 0 ||
        e.currentTarget.hasPointerCapture(e.pointerId)
      ) {
        scrubTo(e.clientX)
      }
    },
    [scrubTo],
  )

  const activePoint = active != null ? points[active] : undefined
  /** 读数挪到悬停列旁边（左半边往右开，右半边往左开），不压住正在读的那根柱 */
  const tipCenter = active != null ? xOf(active) : 0
  const tipSide: 'right' | 'left' =
    width > 0 && tipCenter > width / 2 ? 'left' : 'right'
  const tipLeft =
    tipSide === 'right' ? tipCenter + TIP_OFFSET : tipCenter - TIP_OFFSET

  /** 图例只为图上的记号服务；表格视图里列头已经说明了序列 */
  const legend =
    view === 'chart' ? (
      <ul className="site-analytics-legend">
        <li>
          <span
            className="site-analytics-legend-key site-analytics-legend-key--bar"
            aria-hidden
          />
          {primaryLabel}
        </li>
        <li>
          <span
            className="site-analytics-legend-key site-analytics-legend-key--line"
            aria-hidden
          />
          {secondaryLabel}
        </li>
      </ul>
    ) : (
      <span />
    )

  return (
    <div className="site-analytics-chart-block">
      <div className="site-analytics-chart-head">
        {legend}
        <SegmentedControl<ViewMode>
          size="sm"
          value={view}
          onChange={setView}
          ariaLabel={a.viewAria}
          options={[
            { value: 'chart', label: a.viewChart, icon: <LuBarChart3 size={13} /> },
            { value: 'table', label: a.viewTable, icon: <LuList size={13} /> },
          ]}
        />
      </div>

      {view === 'chart' ? (
        <div
          ref={attachPlot}
          className={`site-analytics-plot${refreshing ? ' is-refreshing' : ''}`}
          tabIndex={0}
          role="img"
          aria-label={chartAria}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
          }}
          style={{ touchAction: 'none' }}
        >
          {width > 0 ? (
            <svg
              width={width}
              height={SVG_H}
              viewBox={`0 0 ${width} ${SVG_H}`}
              focusable="false"
              aria-hidden
            >
              {/* 刻度：发丝实线 + 整数标签 */}
              {axis.ticks.map((tick) => {
                const y = yOf(tick)
                return (
                  <g key={tick}>
                    <line
                      className="site-analytics-grid"
                      x1={GUTTER_L}
                      x2={width - GUTTER_R}
                      y1={px(y)}
                      y2={px(y)}
                    />
                    <text
                      className="site-analytics-tick"
                      x={GUTTER_L - 6}
                      y={px(y)}
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {count(tick, numberLocale)}
                    </text>
                  </g>
                )
              })}

              {/* 悬停列的竖向定位线，压在柱下方 */}
              {active != null ? (
                <line
                  className="site-analytics-cursor"
                  x1={px(xOf(active))}
                  x2={px(xOf(active))}
                  y1={TOP_PAD}
                  y2={baseY}
                />
              ) : null}

              {/* 浏览量柱 */}
              {points.map((p, i) => {
                const d = columnPath(
                  xOf(i) - barW / 2,
                  barW,
                  yOf(p.views),
                  baseY,
                )
                if (!d) return null
                return (
                  <path
                    key={p.day}
                    className={`site-analytics-bar${active === i ? ' is-active' : ''}`}
                    d={d}
                  />
                )
              })}

              {/* 访客折线（中性去强调色，形状即身份） */}
              {points.length > 1 ? (
                <polyline
                  className="site-analytics-line"
                  points={linePoints}
                  fill="none"
                />
              ) : null}
              {/*
                末端不放记号，改成把数值直接标在右侧留白里：
                末点必然落在最后一根柱子内部（UV ≤ PV），任何圆点搁那儿
                都像柱子被打了个洞；标注落在柱外的空白上，还多给一个读数。
              */}
              {points.length > 0 ? (
                <text
                  className="site-analytics-end-label"
                  x={px(xOf(points.length - 1) + END_LABEL_GAP)}
                  y={px(yOf(points[points.length - 1]!.visitors))}
                  dominantBaseline="middle"
                >
                  {count(points[points.length - 1]!.visitors, numberLocale)}
                </text>
              ) : null}

              {/* 正在读的那一点才画记号 */}
              {active != null && points[active] ? (
                <circle
                  className="site-analytics-dot"
                  cx={px(xOf(active))}
                  cy={px(yOf(points[active]!.visitors))}
                  r={DOT_R}
                />
              ) : null}

              {/* 基线 */}
              <line
                className="site-analytics-baseline"
                x1={GUTTER_L}
                x2={width - GUTTER_R}
                y1={baseY}
                y2={baseY}
              />

              {/* 日期带 */}
              {points.map((p, i) => {
                const fromEnd = points.length - 1 - i
                if (fromEnd % labelEvery !== 0) return null
                return (
                  <text
                    key={p.day}
                    className="site-analytics-tick"
                    x={px(xOf(i))}
                    y={baseY + AXIS_H - 5}
                    textAnchor="middle"
                  >
                    {shortDay(p.day)}
                  </text>
                )
              })}

              {/* 命中层：整列感应；实际读数由容器 pointer 横扫驱动 */}
              {points.map((p, i) => (
                <rect
                  key={p.day}
                  className="site-analytics-hit"
                  x={px(GUTTER_L + slot * i)}
                  y={TOP_PAD}
                  width={px(Math.max(1, slot))}
                  height={PLOT_H}
                />
              ))}
            </svg>
          ) : null}

          {activePoint ? (
            <div
              className="site-analytics-tip"
              data-side={tipSide}
              role="status"
              style={{ left: `${px(tipLeft)}px` }}
            >
              <span className="site-analytics-tip-day">{activePoint.day}</span>
              <span className="site-analytics-tip-row">
                <span
                  className="site-analytics-legend-key site-analytics-legend-key--bar"
                  aria-hidden
                />
                <strong>{count(activePoint.views, numberLocale)}</strong>
                {primaryLabel}
              </span>
              <span className="site-analytics-tip-row">
                <span
                  className="site-analytics-legend-key site-analytics-legend-key--line"
                  aria-hidden
                />
                <strong>{count(activePoint.visitors, numberLocale)}</strong>
                {secondaryLabel}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="site-analytics-table-wrap">
          <table className="site-analytics-table">
            <caption className="site-analytics-sr">{chartAria}</caption>
            <thead>
              <tr>
                <th scope="col">{tableDayLabel}</th>
                <th scope="col">{primaryLabel}</th>
                <th scope="col">{secondaryLabel}</th>
                {showEngagement ? (
                  <th scope="col">{engagementLabel}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <th scope="row">{p.day}</th>
                  <td>{count(p.views, numberLocale)}</td>
                  <td>{count(p.visitors, numberLocale)}</td>
                  {showEngagement ? (
                    <td>
                      {p.engagementMs && p.engagementMs > 0
                        ? formatDuration(p.engagementMs, numberLocale)
                        : '—'}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TrendChart

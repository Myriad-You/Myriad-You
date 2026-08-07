/**
 * 子分类网格：嵌套多个 SettingGroup，多列排布。
 *
 * 默认 `align="stretch"`：同一行卡片外框强制同高、顶底对齐（最稳妥）。
 * `align="rows"`：额外用 CSS subgrid 让内部标题/区块跨列对齐。
 */

import type { ReactNode } from 'react'
import React, { createContext, useContext, useMemo } from 'react'
import './SettingGroupGrid.css'

export type SettingGroupGridColumns = 1 | 2 | 3
export type SettingGroupGridVariant = 'plain' | 'card'
/**
 * - `stretch`：同排卡片外框同高（默认，最稳）
 * - `rows`：stretch + subgrid 内部区块跨列对齐
 * - `start`：高度随内容，仅顶对齐
 */
export type SettingGroupGridAlign = 'stretch' | 'rows' | 'start'

export interface SettingGroupGridContextValue {
  /** 位于网格内 */
  inGrid: boolean
  /** 是否启用 subgrid 行对齐 */
  alignRows: boolean
}

const SettingGroupGridContext =
  createContext<SettingGroupGridContextValue | null>(null)

export function useSettingGroupGrid(): SettingGroupGridContextValue | null {
  return useContext(SettingGroupGridContext)
}

export interface SettingGroupGridProps {
  children: ReactNode
  /** 宽屏最大列数。默认 `2`。 */
  columns?: SettingGroupGridColumns
  /** 单列最小宽度，容器不够时自动减列。默认 `17.5rem`。 */
  minColumnWidth?: string
  /** `card`（默认）轻量卡片；`plain` 仅间距 */
  variant?: SettingGroupGridVariant
  /**
   * 默认 `stretch`：同排卡片同高。
   * `rows`：同高 + 内部区块 subgrid 对齐。
   */
  align?: SettingGroupGridAlign
  className?: string
  ariaLabel?: string
}

function chunkChildren(children: ReactNode, size: number): ReactNode[][] {
  const items = React.Children.toArray(children).filter(Boolean)
  if (size <= 1) return items.map((item) => [item])
  const rows: ReactNode[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

export const SettingGroupGrid: React.FC<SettingGroupGridProps> = ({
  children,
  columns = 2,
  minColumnWidth = '17.5rem',
  variant = 'card',
  align = 'stretch',
  className = '',
  ariaLabel,
}) => {
  const ctx = useMemo<SettingGroupGridContextValue>(
    () => ({
      inGrid: true,
      alignRows: align === 'rows',
    }),
    [align],
  )

  const rootClass = [
    'setting-group-grid',
    `setting-group-grid--cols-${columns}`,
    `setting-group-grid--align-${align}`,
    variant === 'card' ? 'is-card' : 'is-plain',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const rootStyle = {
    '--sg-grid-min': minColumnWidth,
    '--sg-grid-columns': String(columns),
  } as React.CSSProperties

  /**
   * rows：按列数切行，每行独立 grid，便于 subgrid 共轨。
   * stretch/start：扁平多列即可（stretch 天然同排同高）。
   */
  if (align === 'rows') {
    const rows = chunkChildren(children, columns)
    return (
      <SettingGroupGridContext.Provider value={ctx}>
        <div
          className={rootClass}
          style={rootStyle}
          role="group"
          aria-label={ariaLabel}
        >
          {rows.map((row, index) => (
            <div
              key={index}
              className="setting-group-grid-row"
              style={
                {
                  '--sg-row-cols': String(row.length),
                } as React.CSSProperties
              }
            >
              {row}
            </div>
          ))}
        </div>
      </SettingGroupGridContext.Provider>
    )
  }

  return (
    <SettingGroupGridContext.Provider value={ctx}>
      <div
        className={rootClass}
        style={rootStyle}
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </SettingGroupGridContext.Provider>
  )
}

SettingGroupGrid.displayName = 'SettingGroupGrid'

export default SettingGroupGrid

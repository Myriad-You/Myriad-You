/**
 * 排行条列表：页面 / 事件 / 来源共用
 *
 * - 一个序列一个颜色，不按排名深浅（长度已经在表达大小，色相不重复编码）
 * - 条只是量级速读，每行数值都直接可见（不靠悬停、不靠配色）
 * - 列头与数据行同一套 CSS Grid 模板，数字列天然对齐
 * - 窄容器（两列半幅 / 小屏）用 container query 叠成「名称 → 条 + 数字」
 */

import type { ReactNode } from 'react'
import { LuChevronDown, LuChevronUp } from '@lib/icons'
import React, { useMemo, useState } from 'react'
import { useI18n } from '../../../contexts/I18nContext'
import { SettingsButton } from '../../settings'
import { EmptyCard } from './EmptyCard'

export interface RankSubRow {
  key: string
  name: string
  value: number
  secondary?: string
}

export interface RankRow {
  key: string
  /** 主标题（本地化后的名称） */
  name: string
  /** 副标题：原始路径 / 事件名，等宽显示 */
  meta?: string
  /** 决定条长的主指标 */
  value: number
  /** 已格式化的次要数值 */
  secondary?: string
  /** 已格式化的第三列（如均停），无数据传 undefined */
  tertiary?: string
  /** 事件维度 breakdown（如各 tapp / 平台） */
  subRows?: RankSubRow[]
}

interface RankListProps {
  rows: RankRow[]
  /** 已格式化的主指标（与 value 同序） */
  formatValue: (n: number) => string
  headers: {
    name: string
    value: string
    secondary?: string
    tertiary?: string
  }
  emptyText: string
  /** 空态占位卡的图标，默认收件箱 */
  emptyIcon?: ReactNode
  loading?: boolean
  refreshing?: boolean
  /** 默认展示行数，超出折叠 */
  initialCount?: number
}

const DEFAULT_VISIBLE = 8

export const RankList: React.FC<RankListProps> = ({
  rows,
  formatValue,
  headers,
  emptyText,
  emptyIcon,
  loading = false,
  refreshing = false,
  initialCount = DEFAULT_VISIBLE,
}) => {
  const { t } = useI18n()
  const a = t.config.analytics
  const [expanded, setExpanded] = useState(false)

  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => r.value)),
    [rows],
  )
  const visible = expanded ? rows : rows.slice(0, initialCount)
  const hidden = rows.length - visible.length

  if (rows.length === 0) {
    return <EmptyCard text={emptyText} icon={emptyIcon} loading={loading} />
  }

  const hasSecondary = Boolean(headers.secondary)
  const hasTertiary = Boolean(headers.tertiary) && rows.some((r) => r.tertiary)

  const mods = [
    refreshing ? 'is-refreshing' : '',
    hasSecondary ? 'has-secondary' : '',
    hasTertiary ? 'has-tertiary' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`site-analytics-rank${mods ? ` ${mods}` : ''}`}>
      <div className="site-analytics-rank-head" aria-hidden>
        <span className="site-analytics-rank-h-name">{headers.name}</span>
        {/* 与行内条对齐的空格；叠层时隐藏 */}
        <span className="site-analytics-rank-h-track" />
        <span className="site-analytics-rank-h-value">{headers.value}</span>
        {hasSecondary ? (
          <span className="site-analytics-rank-h-second">{headers.secondary}</span>
        ) : null}
        {hasTertiary ? (
          <span className="site-analytics-rank-h-third">{headers.tertiary}</span>
        ) : null}
      </div>

      <ul className="site-analytics-rank-list">
        {visible.map((row) => {
          const main = formatValue(row.value)
          const aria = [
            row.name,
            headers.value ? `${headers.value} ${main}` : main,
            hasSecondary && row.secondary
              ? `${headers.secondary} ${row.secondary}`
              : null,
            hasTertiary && headers.tertiary && row.tertiary
              ? `${headers.tertiary} ${row.tertiary}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
          const sub = row.subRows?.filter((s) => s.value > 0) ?? []
          return (
            <li key={row.key} className="site-analytics-rank-item">
              <div
                className="site-analytics-rank-row"
                aria-label={aria}
              >
                <div className="site-analytics-rank-label">
                  <span className="site-analytics-rank-name">{row.name}</span>
                  {row.meta ? (
                    <span className="site-analytics-rank-meta" title={row.meta}>
                      {row.meta}
                    </span>
                  ) : null}
                </div>

                <div className="site-analytics-rank-track" aria-hidden>
                  <div
                    className="site-analytics-rank-bar"
                    style={{
                      width: `${Math.max(1.5, (row.value / max) * 100)}%`,
                    }}
                  />
                </div>

                <span className="site-analytics-rank-value">{main}</span>
                {hasSecondary ? (
                  <span className="site-analytics-rank-second">
                    {row.secondary ?? '—'}
                  </span>
                ) : null}
                {hasTertiary ? (
                  <span className="site-analytics-rank-third">
                    {row.tertiary ?? '—'}
                  </span>
                ) : null}
              </div>
              {sub.length > 0 ? (
                <ul className="site-analytics-rank-sublist">
                  {sub.map((s) => {
                    const sMain = formatValue(s.value)
                    return (
                      <li
                        key={s.key}
                        className="site-analytics-rank-row site-analytics-rank-row--sub"
                        aria-label={`${row.name} · ${s.name} · ${sMain}`}
                      >
                        <div className="site-analytics-rank-label">
                          <span className="site-analytics-rank-name">
                            {s.name}
                          </span>
                        </div>
                        <div className="site-analytics-rank-track" aria-hidden>
                          <div
                            className="site-analytics-rank-bar"
                            style={{
                              width: `${Math.max(1.5, (s.value / max) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="site-analytics-rank-value">
                          {sMain}
                        </span>
                        {hasSecondary ? (
                          <span className="site-analytics-rank-second">
                            {s.secondary ?? '—'}
                          </span>
                        ) : null}
                        {hasTertiary ? (
                          <span className="site-analytics-rank-third">—</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      {hidden > 0 || expanded ? (
        <div className="site-analytics-rank-more">
          <SettingsButton
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            icon={
              expanded ? <LuChevronUp size={13} /> : <LuChevronDown size={13} />
            }
          >
            {expanded
              ? a.showLess
              : a.showMoreN.replace('{n}', String(hidden))}
          </SettingsButton>
        </div>
      ) : null}
    </div>
  )
}

export default RankList

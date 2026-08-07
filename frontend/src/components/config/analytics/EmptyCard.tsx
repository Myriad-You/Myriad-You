/**
 * 空态占位卡：撑住区块高度，别让「暂无数据」塌成孤零零一行字。
 *
 * 首帧还在取数时只占位、不下结论（与 KPI 磁贴的「…」一致）。
 */

import type { ReactNode } from 'react'
import { LuInbox } from '@lib/icons'
import React from 'react'

interface EmptyCardProps {
  text: string
  icon?: ReactNode
  /** 首帧加载中 */
  loading?: boolean
  /** 顶替图表时用更高的占位，切换时不跳版 */
  tall?: boolean
}

export const EmptyCard: React.FC<EmptyCardProps> = ({
  text,
  icon,
  loading = false,
  tall = false,
}) => (
  <div
    className={`site-analytics-empty${tall ? ' site-analytics-empty--tall' : ''}`}
    role={loading ? 'status' : undefined}
  >
    <span className="site-analytics-empty-icon" aria-hidden>
      {icon ?? <LuInbox size={18} />}
    </span>
    <span>{loading ? '…' : text}</span>
  </div>
)

export default EmptyCard

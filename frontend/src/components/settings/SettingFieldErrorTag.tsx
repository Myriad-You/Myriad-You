/**
 * 选项标题旁的字段报错标签。
 * 复用 SettingTitleTag danger 变体（与站点分析 / 标题旁标签同一套）。
 */

import type { ReactNode } from 'react'
import React from 'react'
import { SettingTitleTag } from './SettingTitleTag'

export interface SettingFieldErrorTagProps {
  children: ReactNode
  /** 完整错误文案（hover）；默认用 children 字符串 */
  title?: string
  className?: string
}

export function SettingFieldErrorTag({
  children,
  title,
  className = '',
}: SettingFieldErrorTagProps) {
  if (children == null || children === false || children === '') {
    return null
  }
  const tip =
    title ??
    (typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined)
  return (
    <SettingTitleTag
      variant="danger"
      title={tip}
      className={className}
    >
      {children}
    </SettingTitleTag>
  )
}

SettingFieldErrorTag.displayName = 'SettingFieldErrorTag'

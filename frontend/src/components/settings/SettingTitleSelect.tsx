/**
 * 设置标题旁紧凑下拉（SettingTitleTag 的 select 变种）。
 *
 * 用于分组标题行筛选（如 AI 用量：用户 / 模型），外观对齐 title-tag chip，
 * 选项列表复用 FieldSelect（深浅色、键盘、typeahead）。
 */

import type { ReactNode } from 'react'
import type { SettingOption } from './types'
import { FieldSelect } from './items/FieldSelect'
import './SettingTitleSelect.css'

export interface SettingTitleSelectProps<T extends string = string> {
  value: T
  options: SettingOption<T>[]
  onChange: (value: T) => void
  /** 左侧小图标（与 SettingTitleTag 同级） */
  icon?: ReactNode
  /**
   * 可选前缀文案（如「用户」）；当前选中值由 FieldSelect 显示。
   * 无障碍名优先用 aria-label，否则退回 label。
   */
  label?: string
  'aria-label'?: string
  disabled?: boolean
  className?: string
  /**
   * title = 标题行 chip（默认）；field = 普通字段外观（较少用）。
   */
  variant?: 'title' | 'field'
  /** 菜单内搜索过滤（用户列表等） */
  searchable?: boolean
  searchPlaceholder?: string
  emptySearchText?: string
}

export function SettingTitleSelect<T extends string = string>({
  value,
  options,
  onChange,
  icon,
  label,
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
  variant = 'title',
  searchable = false,
  searchPlaceholder,
  emptySearchText,
}: SettingTitleSelectProps<T>) {
  const classes = [
    'setting-title-select',
    variant === 'title'
      ? 'setting-title-select--title'
      : 'setting-title-select--field',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={classes}
      onClick={(e) => {
        // 折叠组标题是 button 时，避免点筛选触发展开/收起
        e.stopPropagation()
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {icon ? (
        <span className="setting-title-select-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      {label ? (
        <span className="setting-title-select-prefix">{label}</span>
      ) : null}
      <FieldSelect
        size="sm"
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel || label}
        className="setting-title-select-field"
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        emptySearchText={emptySearchText}
      />
    </span>
  )
}

SettingTitleSelect.displayName = 'SettingTitleSelect'

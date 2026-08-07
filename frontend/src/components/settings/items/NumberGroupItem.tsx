/**
 * 数字输入组设置项组件
 * 将多个数字输入选项组合为卡片组，共享标签和描述
 */

import type { ReactNode } from 'react'
import React, { useCallback } from 'react'
import { guideDomProps } from '../guides/guideAnchor'
import { SettingTitleGuideEntry } from '../SettingTitleGuideEntry'

import './SettingItem.css'

export interface NumberGroupOption {
  /** 唯一标识 */
  key: string
  /** 选项显示文本 */
  label: string
  /** 选项说明文本 */
  description?: string
  /** 当前值 */
  value: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步进 */
  step?: number
  /** 单位 */
  unit?: string
}

export interface NumberGroupItemProps {
  /** 组标签 */
  label: string
  /** 描述说明 */
  description?: string
  /** 选项指南 */
  guide?: ReactNode
  /** 指南路径（搜索跳转） */
  guidePath?: string
  /** 提示文本 */
  hint?: string
  /** 选项列表 */
  options: NumberGroupOption[]
  /** 值变化回调 */
  onChange: (key: string, value: number) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义 class */
  className?: string
}

export const NumberGroupItem = React.memo<NumberGroupItemProps>(
  ({
    label,
    description,
    guide,
    guidePath,
    hint,
    options,
    onChange,
    disabled = false,
    className = '',
  }) => {
    const handleChange = useCallback(
      (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return
        const raw = e.target.value.trim()
        // Allow empty while typing; commit 0 only when field is cleared on blur-equivalent empty string
        if (raw === '') {
          onChange(key, 0)
          return
        }
        const numValue = Number.parseFloat(raw)
        if (Number.isFinite(numValue)) onChange(key, numValue)
      },
      [onChange, disabled],
    )

    const showLabel = Boolean(label) || Boolean(description) || Boolean(guide)
    const anchorProps = guideDomProps(guidePath)

    return (
      <div
        {...anchorProps}
        className={`setting-item setting-vertical ${className} ${disabled ? 'disabled' : ''}${guidePath ? ' has-guide-anchor' : ''}`}
      >
        {showLabel && (
          <div className="setting-label">
            {label ? (
              <span className="setting-label-text">
                {label}
                <SettingTitleGuideEntry title={label} guide={guide} />
              </span>
            ) : (
              <SettingTitleGuideEntry title={label} guide={guide} />
            )}
            {description && (
              <span className="setting-description">{description}</span>
            )}
          </div>
        )}
        <div className="number-group-options">
          {options.map((option) => (
            <div key={option.key} className="number-group-card">
              <span className="number-group-card-label">{option.label}</span>
              {option.description && (
                <span className="number-group-card-desc">
                  {option.description}
                </span>
              )}
              <div className="number-group-card-input">
                <input
                  type="number"
                  value={option.value}
                  onChange={handleChange(option.key)}
                  min={option.min}
                  max={option.max}
                  step={option.step ?? 1}
                  disabled={disabled}
                  className="field-input"
                  aria-label={option.label}
                  autoComplete="one-time-code"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
                {option.unit && (
                  <span className="number-group-card-unit">{option.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {hint && <p className="setting-hint">{hint}</p>}
      </div>
    )
  },
)

NumberGroupItem.displayName = 'NumberGroupItem'

/**
 * 按钮设置项组件 — 行标签壳 + SettingsButton
 */

import type { ReactNode } from 'react'
import type { ButtonSettingConfig } from '../types'
import React, { useCallback, useState } from 'react'
import { SettingItemWrapper } from './SettingItemWrapper'
import { SettingsButton } from './SettingsButton'
import './SettingItem.css'

export interface ButtonItemProps extends Omit<ButtonSettingConfig, 'type'> {
  /** 异步操作 */
  asyncAction?: boolean
  /** 操作结果 */
  result?: {
    success: boolean
    message: string
  } | null
  /** 自定义结果渲染 */
  renderResult?: (result: { success: boolean; message: string }) => ReactNode
}

export const ButtonItem = React.memo<ButtonItemProps>(
  ({
    label,
    detail,
    description,
    hint,
    onClick,
    buttonText,
    buttonIcon,
    variant = 'secondary',
    disabled = false,
    loading: externalLoading = false,
    size = 'md',
    layout = 'vertical',
    asyncAction = false,
    result,
    renderResult,
    className = '',
  }) => {
    const [internalLoading, setInternalLoading] = useState(false)
    const loading = externalLoading || internalLoading

    const handleClick = useCallback(async () => {
      if (disabled || loading) return

      if (!asyncAction) {
        onClick()
        return
      }

      setInternalLoading(true)
      try {
        await Promise.resolve(onClick())
      } finally {
        setInternalLoading(false)
      }
    }, [onClick, disabled, loading, asyncAction])

    const btnVariant =
      variant === 'primary' || variant === 'danger' || variant === 'secondary'
        ? variant
        : 'secondary'

    const btnSize = size === 'sm' || size === 'lg' ? size : 'md'

    return (
      <SettingItemWrapper
        label={label}
        detail={detail}
        description={description}
        hint={hint}
        layout={layout}
        size={size}
        className={`setting-item-button ${className}`}
        disabled={disabled}
        contentRight={true}
      >
        <div className="setting-button-row">
          <SettingsButton
            variant={btnVariant}
            size={btnSize}
            onClick={handleClick}
            disabled={disabled}
            loading={loading}
            icon={buttonIcon}
          >
            {buttonText}
          </SettingsButton>
          {result &&
            (renderResult ? (
              renderResult(result)
            ) : (
              <span
                className={`test-result ${result.success ? 'success' : 'error'}`}
              >
                {result.message}
              </span>
            ))}
        </div>
      </SettingItemWrapper>
    )
  },
)

ButtonItem.displayName = 'ButtonItem'

/**
 * IslandButton — 控制岛操作按钮
 * 统一尺寸 / hover 微交互 / 色彩变体
 */

import { ISLAND_BTN, ISLAND_BTN_DANGER, ISLAND_BTN_PRIMARY } from './constants'

type ButtonVariant = 'default' | 'primary' | 'danger'

export interface IslandButtonProps {
  onClick: () => void
  children: React.ReactNode
  /** 按钮变体 */
  variant?: ButtonVariant
  /** 额外文本标签（按钮图标右侧） */
  label?: string
  title?: string
  disabled?: boolean
  className?: string
}

const variantClass: Record<ButtonVariant, string> = {
  default: ISLAND_BTN,
  primary: ISLAND_BTN_PRIMARY,
  danger: ISLAND_BTN_DANGER,
}

export function IslandButton({
  onClick,
  children,
  variant = 'default',
  label,
  title,
  disabled = false,
  className = '',
}: IslandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`${variantClass[variant]} ${className}`}
    >
      {children}
      {label && <span className="text-sm">{label}</span>}
    </button>
  )
}

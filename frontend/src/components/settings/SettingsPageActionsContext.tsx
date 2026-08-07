/**
 * 设置页级操作（当前页重置等），由 ConfigForm 按 activeSection 注入。
 */

import React, { createContext, useContext } from 'react'

export interface SettingsPageActionsContextValue {
  /** 重置当前设置页（默认值 + 保存相关部分） */
  resetCurrentPage?: () => void | Promise<void>
  /** 是否允许重置本页；about 等只读页为 false */
  canResetCurrentPage?: boolean
}

const SettingsPageActionsContext =
  createContext<SettingsPageActionsContextValue | null>(null)

export function useSettingsPageActions(): SettingsPageActionsContextValue | null {
  return useContext(SettingsPageActionsContext)
}

export const SettingsPageActionsProvider: React.FC<{
  value: SettingsPageActionsContextValue
  children: React.ReactNode
}> = ({ value, children }) => (
  <SettingsPageActionsContext.Provider value={value}>
    {children}
  </SettingsPageActionsContext.Provider>
)

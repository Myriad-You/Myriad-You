/**
 * 每个设置页（SettingSection）右上角「显示说明」开关状态。
 *
 * 关闭：description / detail 仅 ⓘ tooltip；guide 入口不出现。
 * 开启：description / detail 标题下常显；有 guide 的标题旁出现入口，
 *       点击后以浮窗展示大号介绍（优先上方；上方不够则左侧）。
 */

import React, { createContext, useContext } from 'react'

export interface SettingsHelpContextValue {
  /** 是否展开短说明，并显示选项指南入口（点击后展开） */
  showDetails: boolean
  setShowDetails: (value: boolean) => void
}

const SettingsHelpContext = createContext<SettingsHelpContextValue | null>(
  null,
)

export function useSettingsHelp(): SettingsHelpContextValue | null {
  return useContext(SettingsHelpContext)
}

export const SettingsHelpProvider: React.FC<{
  value: SettingsHelpContextValue
  children: React.ReactNode
}> = ({ value, children }) => (
  <SettingsHelpContext.Provider value={value}>
    {children}
  </SettingsHelpContext.Provider>
)

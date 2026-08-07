/**
 * 宿主面板 ID（非真实 Tapp 包）
 *
 * 可在多窗口管理器中以「系统窗口」打开，使用宿主 React UI，
 * 不走沙箱 / manifest / 安装流程。
 */

/** 应用商店宿主面板 */
export const HOST_PANEL_STORE_ID = 'myriad:host.store'

/** 是否为宿主面板 ID（`myriad:host.*`） */
export function isHostPanelId(id: string): boolean {
  return id.startsWith('myriad:host.')
}

/** 是否为商店宿主面板 */
export function isStoreHostPanel(id: string): boolean {
  return id === HOST_PANEL_STORE_ID
}

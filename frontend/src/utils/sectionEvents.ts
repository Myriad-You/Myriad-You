/**
 * 板块详情弹窗事件总线
 * 小组件(如 welcome 的引导卡)通过该事件请求打开某个板块的详情弹窗,
 * 由 Home 统一监听并渲染 DetailModal。
 */

export const OPEN_SECTION_EVENT = 'myriad:open-section'

export function requestOpenSection(sectionId: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_SECTION_EVENT, { detail: sectionId }))
}

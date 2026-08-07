/**
 * 选项指南 DOM 锚点：搜索结果点击后滚到具体配置项。
 * 约定 id = cfg-g-{area}-{key}，data-guide-path = area.key
 */

import { prefersReducedMotion, SETTINGS_DURATION_MS } from '../motion'

export const GUIDE_PATH_ATTR = 'data-guide-path'

/** advanced.proxyEnable → cfg-g-advanced-proxyEnable（可选 id，可重复场景慎用） */
export function guideAnchorId(path: string): string {
  const cleaned = path.trim().replace(/^\.+|\.+$/g, '')
  if (!cleaned) return ''
  return `cfg-g-${cleaned.replace(/\./g, '-')}`
}

/**
 * 供 SettingGroup / SettingItem 根节点展开。
 * 只用 data-guide-path，不写 id——同一 path 可能出现多次（如多源通知），
 * 重复 id 会破坏 TOC / 无障碍；跳转用 querySelector 取第一个即可。
 */
export function guideDomProps(guidePath?: string | null): {
  [GUIDE_PATH_ATTR]?: string
} {
  if (!guidePath?.trim()) return {}
  return { [GUIDE_PATH_ATTR]: guidePath.trim() }
}

export function findGuideElement(path: string): HTMLElement | null {
  if (typeof document === 'undefined' || !path.trim()) return null
  // 可选显式 id（手动挂的）优先
  const id = guideAnchorId(path)
  if (id) {
    const byId = document.getElementById(id)
    if (byId) return byId
  }
  const safe = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return document.querySelector<HTMLElement>(
    `[${GUIDE_PATH_ATTR}="${safe}"]`,
  )
}

/** 展开折叠祖先，使目标可见 */
export function expandCollapsibleAncestors(el: HTMLElement): boolean {
  let expanded = false
  let node: HTMLElement | null = el
  while (node) {
    if (
      node.classList.contains('setting-group') &&
      node.classList.contains('is-collapsed')
    ) {
      const toggle = node.querySelector<HTMLButtonElement>(
        '.setting-group-header-toggle[aria-expanded="false"]',
      )
      if (toggle) {
        toggle.click()
        expanded = true
      }
    }
    node = node.parentElement
  }
  return expanded
}

const FLASH_CLASS = 'is-guide-flash'
const FLASH_MS = 1600

/**
 * 滚到指南对应选项。返回是否找到元素。
 * 若需展开折叠区，会短暂延迟再滚动。
 */
export function scrollToSettingGuide(
  path: string,
  options?: { highlight?: boolean },
): boolean {
  const el = findGuideElement(path)
  if (!el) return false

  const didExpand = expandCollapsibleAncestors(el)
  const highlight = options?.highlight !== false
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'

  const run = () => {
    el.scrollIntoView({ behavior, block: 'center' })
    if (!highlight) return
    el.classList.remove(FLASH_CLASS)
    // 强制重启动画
    void el.offsetWidth
    el.classList.add(FLASH_CLASS)
    window.setTimeout(() => {
      el.classList.remove(FLASH_CLASS)
    }, FLASH_MS)
  }

  if (didExpand) {
    window.setTimeout(
      run,
      prefersReducedMotion() ? 0 : SETTINGS_DURATION_MS.base + 40,
    )
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
  }
  return true
}

/**
 * 切换分类后：等 SectionSwitch commit + 内容挂载再滚。
 * 可多次 retry（部分区块异步渲染）。
 */
export function scheduleScrollToSettingGuide(
  path: string,
  options?: { attempts?: number; delayMs?: number },
): void {
  const attempts = options?.attempts ?? 8
  const delayMs =
    options?.delayMs ??
    (prefersReducedMotion() ? 0 : SETTINGS_DURATION_MS.slow + 80)

  let left = attempts
  const tryScroll = () => {
    if (scrollToSettingGuide(path)) return
    left -= 1
    if (left <= 0) return
    window.setTimeout(tryScroll, 80)
  }

  window.setTimeout(tryScroll, delayMs)
}

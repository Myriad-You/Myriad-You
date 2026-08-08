/**
 * Built-in widget catalog for the static site home grid.
 * 仅保留无需后端的活体小组件(welcome / weather)
 * 与静态官网板块卡(site-card,内容来自 content/site.ts)。
 */

import type { ComponentType } from 'react'
import type { TranslationKeys } from '../../i18n'
import type { WidgetComponentProps, WidgetSize, WidgetType } from '../WidgetGrid'
import { lazy } from 'react'

// React.lazy + 与 preload 共用 Promise。
function lazyWidget<K extends string>(
  factory: () => Promise<Record<K, ComponentType<WidgetComponentProps>>>,
  name: K,
) {
  let shared: Promise<{ default: ComponentType<WidgetComponentProps> }> | null =
    null
  const load = () => {
    shared ||= factory().then((m) => ({ default: m[name] }))
    return shared
  }
  const component = lazy(load)
  ;(component as unknown as { preload: () => Promise<unknown> }).preload = load
  return component
}

const WeatherWidget = lazyWidget(
  () => import('./WeatherWidget'),
  'WeatherWidget',
)
const WelcomeWidget = lazyWidget(
  () => import('./WelcomeWidget'),
  'WelcomeWidget',
)
const SiteCardWidget = lazyWidget(
  () => import('./SiteCardWidget'),
  'SiteCardWidget',
)

type WidgetsI18n = TranslationKeys['widgets']

/** Base config without localized name — useful for static references / tests */
export const BUILTIN_WIDGET_BASE_CONFIG = {
  welcome: {
    defaultSize: '4x2' as WidgetSize,
    component: WelcomeWidget,
    supportedSizes: ['2x2', '4x2'] as WidgetSize[],
  },
  weather: {
    defaultSize: '2x2' as WidgetSize,
    component: WeatherWidget,
    supportedSizes: ['2x2', '4x2', '4x1'] as WidgetSize[],
  },
  'site-card': {
    defaultSize: '2x2' as WidgetSize,
    component: SiteCardWidget,
    supportedSizes: ['2x2', '4x2'] as WidgetSize[],
  },
} as const

export type BuiltinWidgetId = keyof typeof BUILTIN_WIDGET_BASE_CONFIG

/** Stable catalog order */
const BUILTIN_WIDGET_ORDER: BuiltinWidgetId[] = [
  'welcome',
  'weather',
  'site-card',
]

/** Map widget id → t.widgets key(site-card 名称来自 content/site.ts,不走 i18n) */
const WIDGET_NAME_KEY: Partial<Record<BuiltinWidgetId, keyof WidgetsI18n>> = {
  welcome: 'welcome',
  weather: 'weather',
}

/**
 * 预加载布局中用到的小组件实现(须在 setWidgets / 入场前 await)。
 */
export function preloadBuiltinWidgets(types: Iterable<string>): Promise<void> {
  const jobs: Promise<unknown>[] = []
  const seen = new Set<unknown>()

  for (const type of Array.from(types)) {
    const base = BUILTIN_WIDGET_BASE_CONFIG[type as BuiltinWidgetId]
    if (!base || seen.has(base.component)) continue
    seen.add(base.component)
    const preload = (
      base.component as unknown as { preload?: () => Promise<unknown> }
    ).preload
    if (preload) jobs.push(preload().catch(() => {}))
  }

  return Promise.all(jobs).then(() => undefined)
}

/**
 * Built-in WidgetType[] with localized names.
 */
export function getBuiltinWidgets(widgetsI18n: WidgetsI18n): WidgetType[] {
  return BUILTIN_WIDGET_ORDER.map((id) => {
    const base = BUILTIN_WIDGET_BASE_CONFIG[id]
    const nameKey = WIDGET_NAME_KEY[id]
    return {
      id,
      name: nameKey ? widgetsI18n[nameKey] : '官网板块',
      defaultSize: base.defaultSize,
      component: base.component,
      supportedSizes: [...base.supportedSizes],
    }
  })
}

/**
 * 清单展示文案（name/description）的多语言解析。
 *
 * manifest.locales 键为 BCP-47 语言标签；解析回退链：
 * 精确匹配（忽略大小写）→ 语言前缀匹配（zh-CN ↔ zh）→ 顶层 name/description。
 */

import type { TappManifestLocaleEntry, TappManifestLocales } from '../types'

/** 解析后的清单展示文案 */
export interface LocalizedManifestText {
  name: string
  description?: string
}

function pickEntry(
  locales: TappManifestLocales | undefined,
  locale: string | undefined,
): TappManifestLocaleEntry | undefined {
  if (!locales || !locale) return undefined
  const target = locale.toLowerCase()
  const keys = Object.keys(locales)

  const exact = keys.find((key) => key.toLowerCase() === target)
  if (exact) return locales[exact]

  const targetLang = target.split('-')[0]
  const prefix = keys.find(
    (key) => key.toLowerCase().split('-')[0] === targetLang,
  )
  return prefix ? locales[prefix] : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/**
 * 按宿主当前语言解析清单的 name/description。
 * 接受最小结构，方便清单对象与后端列表项复用。
 */
export function resolveManifestText(
  source: {
    name: string
    description?: string
    locales?: TappManifestLocales
  },
  locale: string | undefined,
): LocalizedManifestText {
  const entry = pickEntry(source.locales, locale)
  return {
    name: nonEmpty(entry?.name) ?? source.name,
    description: nonEmpty(entry?.description) ?? source.description,
  }
}

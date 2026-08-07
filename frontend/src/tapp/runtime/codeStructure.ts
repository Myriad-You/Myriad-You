import type { TappCodeStructure, TappInstance } from '../types'

/** 按沙箱模式组合需要执行的代码。 */
export function getCodeForMode(
  code: TappCodeStructure,
  mode: 'widget' | 'page' | 'background',
): string {
  switch (mode) {
    case 'widget':
      return code.widget
        ? `${code.core}\n\n// ========== Widget Code ==========\n${code.widget}`
        : code.core
    case 'page':
      return code.page
        ? `${code.core}\n\n// ========== Page Code ==========\n${code.page}`
        : code.core
    case 'background':
      return code.core
  }
}

function hashParts(parts: string[]): string {
  let fnv = 0x811C9DC5
  let djb = 5381
  let totalLength = 0
  for (const part of parts) {
    const framed = `${part.length}:`
    totalLength += part.length
    for (let index = 0; index < framed.length; index++) {
      const code = framed.charCodeAt(index)
      fnv ^= code
      fnv = Math.imul(fnv, 0x01000193)
      djb = Math.imul(djb, 33) ^ code
    }
    for (let index = 0; index < part.length; index++) {
      const code = part.charCodeAt(index)
      fnv ^= code
      fnv = Math.imul(fnv, 0x01000193)
      djb = Math.imul(djb, 33) ^ code
    }
  }
  return `${totalLength}:${(fnv >>> 0).toString(36)}:${(djb >>> 0).toString(36)}`
}

function sortedRecordParts(record?: Record<string, string>): string[] {
  if (!record) return []
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) => [key, value])
}

/**
 * 内容级 iframe 指纹。不能只比较长度或模块名，否则等长更新会继续运行旧代码。
 */
export function getCodeStructureFingerprint(
  code: TappCodeStructure,
  mode: 'widget' | 'page' | 'background',
): string {
  if (mode === 'background') {
    return hashParts([code.core, JSON.stringify(code.i18n || {})])
  }
  if (mode === 'widget') {
    return hashParts([
      code.core,
      code.widget || '',
      code.widgetHtml || '',
      code.styles || '',
      code.widgetCSS || '',
    ])
  }
  return hashParts([
    code.core,
    code.page || '',
    code.pageHtml || '',
    code.styles || '',
    code.pageCSS || '',
    ...sortedRecordParts(code.pageModules),
    JSON.stringify(code.pageModuleOrder || []),
    JSON.stringify(code.i18n || {}),
  ])
}

/** Manifest/runtime contract changes require a new SDK and handler set. */
export function getTappRuntimeFingerprint(instance: TappInstance): string {
  return hashParts([
    JSON.stringify(instance.manifest),
    JSON.stringify([...instance.grantedPermissions].sort()),
    instance.userRole,
    String(instance.isTemporary ?? false),
    String(instance.isAdminTapp ?? false),
  ])
}

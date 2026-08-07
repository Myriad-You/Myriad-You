import { proxyImageUrl, proxyImageUrlOr } from '../../../utils/proxyImageUrl'

export function normalizeHttpsMediaUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null
  let u = url.trim()
  if (!u) return null
  if (u.startsWith('//')) u = `https:${u}`
  if (u.startsWith('http://')) u = `https://${u.slice(7)}`
  return u
}

/**
 * Xbox / MS 商店图常给 http:// 或非 SSL 域名，HTTPS 页面会因混合内容被拦。
 * 统一升到 https，并把 images-eds → images-eds-ssl（不强制代理；xboxlive 直链可用）。
 */
export function normalizeXboxMediaUrl(url?: string | null): string | null {
  const base = normalizeHttpsMediaUrl(url)
  if (!base) return null
  return base.replace(
    '://images-eds.xboxlive.com',
    '://images-eds-ssl.xboxlive.com',
  )
}

/**
 * 单字段兜底：仅用于「前端拼 CDN」或独立 presence API 等未走
 * extractCardVisuals 入口的路径。报告卡 body 请依赖入口 normalizeJsonMediaUrls。
 */
export function resolveMediaUrl(url?: string | null): string | null {
  const base = normalizeHttpsMediaUrl(url)
  if (!base) return null
  return proxyImageUrl(base) ?? base
}

/** Bilibili 封面：无图时占位；有图时走 proxy（兼容预览/直链） */
export function getBilibiliProxyUrl(cover?: string, title?: string): string {
  if (!cover) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'B')}&size=400&background=00A1D6&color=fff`
  }
  return proxyImageUrlOr(
    cover,
    `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'B')}&size=400&background=00A1D6&color=fff`,
  )
}

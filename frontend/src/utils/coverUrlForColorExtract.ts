/**
 * 网易/QQ 封面改小尺寸 URL，加速取色解码（显示仍用原 cover）。
 * 纯函数，可在 Node 单测中直接验证。
 *
 * 若 cover 已是 `/api/proxy/image?url=…`，在解码后的上游 URL 上改尺寸，
 * 再包回代理（同源 + 防盗链，canvas 可读像素）。
 */
export function coverUrlForColorExtract(url: string): string {
  if (!url) return url
  try {
    let upstream = url
    let proxied = false
    const proxyMatch = url.match(/\/api\/proxy\/image\?url=([^&]+)/i)
    if (proxyMatch) {
      try {
        upstream = decodeURIComponent(proxyMatch[1])
        proxied = true
      } catch {
        return url
      }
    }

    let resized = upstream
    // 网易云：支持 ?param=WxH（CDN .net / 主站 .com 均可能出现）
    if (
      /music\.(126|163)\.(net|com)/i.test(upstream) ||
      /p\d+\.music\.126\.net/i.test(upstream)
    ) {
      if (/[?&]param=\d+y\d+/i.test(upstream)) {
        resized = upstream.replace(/([?&]param=)\d+y\d+/i, '$1150y150')
      } else {
        resized = upstream.includes('?')
          ? `${upstream}&param=150y150`
          : `${upstream}?param=150y150`
      }
    } else if (
      /y\.gtimg\.cn\/music\/photo_new\/T002R\d+x\d+M000/i.test(upstream)
    ) {
      // QQ 音乐相册图：T002R300x300 → 更小
      resized = upstream.replace(/T002R\d+x\d+M000/i, 'T002R150x150M000')
    } else if (!proxied) {
      return url
    }

    if (!proxied) return resized
    // 保留原代理前缀形态（相对 / 绝对）
    const prefix = url.slice(0, url.indexOf('url='))
    return `${prefix}url=${encodeURIComponent(resized)}`
  } catch {
    /* keep original */
  }
  return url
}

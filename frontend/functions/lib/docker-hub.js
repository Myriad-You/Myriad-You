/**
 * Docker Hub 公共 API 的共享访问层（Cloudflare Pages Functions）。
 * 官网访客（尤其大陆网络）浏览器直连 hub.docker.com 常常失败，
 * 边缘节点服务端出站则稳定可达；响应在边缘缓存，避免触发 Hub 匿名限流。
 */

export const HUB_REPO_BASE = 'https://hub.docker.com/v2/repositories/somekawahitomi'

export function jsonResponse(data, { status = 200, cacheSeconds = 0 } = {}) {
  const headers = { 'content-type': 'application/json; charset=utf-8' }
  headers['cache-control'] = cacheSeconds > 0
    ? `public, max-age=${cacheSeconds}`
    : 'no-store'
  return new Response(JSON.stringify(data), { status, headers })
}

export async function fetchHubJson(url) {
  const resp = await fetch(url, { headers: { accept: 'application/json' } })
  if (!resp.ok) throw new Error(`Docker Hub responded ${resp.status}`)
  return resp.json()
}

/** 命中边缘缓存则直接返回；未命中时执行 produce() 并异步写缓存 */
export async function withEdgeCache(context, produce) {
  const cacheKey = new Request(context.request.url, { method: 'GET' })
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached

  const response = await produce()
  if (response.status === 200) {
    context.waitUntil(caches.default.put(cacheKey, response.clone()))
  }
  return response
}

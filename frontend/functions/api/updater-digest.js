/**
 * GET /api/updater-digest?tag=v1.2.3
 *
 * 返回与 Docker Hub v2 兼容的 { digest, images }，
 * 官网配置生成器的 extractDigestFromHubTag 可零改动解析。
 * digest 对同一 tag 不可变，边缘缓存 24 小时。
 */
import { fetchHubJson, HUB_REPO_BASE, jsonResponse, withEdgeCache } from '../lib/docker-hub'

const TAG_RE = /^\w[\w.-]{0,127}$/

export async function onRequestGet(context) {
  const tag = new URL(context.request.url).searchParams.get('tag') || ''
  if (!TAG_RE.test(tag)) {
    return jsonResponse({ error: 'invalid tag' }, { status: 400 })
  }

  return withEdgeCache(context, async () => {
    try {
      const data = await fetchHubJson(
        `${HUB_REPO_BASE}/myriad-updater/tags/${encodeURIComponent(tag)}`,
      )
      return jsonResponse(
        { digest: data.digest || null, images: data.images || [] },
        { cacheSeconds: 86400 },
      )
    } catch (err) {
      return jsonResponse(
        { error: String((err && err.message) || err) },
        { status: 502 },
      )
    }
  })
}

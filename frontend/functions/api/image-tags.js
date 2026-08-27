/**
 * GET /api/image-tags?repo=myriad-backend
 *
 * 返回与 Docker Hub v2 兼容的 { results: [{ name }] }，
 * 官网配置生成器的 extractTagNamesFromHubPayload 可零改动解析。
 * 边缘缓存 10 分钟（tag 列表会随发布变化）。
 */
import { fetchHubJson, HUB_REPO_BASE, jsonResponse, withEdgeCache } from '../lib/docker-hub'

const REPO_RE = /^[a-z0-9][a-z0-9-]{1,62}$/

export async function onRequestGet(context) {
  const repo = new URL(context.request.url).searchParams.get('repo') || ''
  if (!REPO_RE.test(repo)) {
    return jsonResponse({ error: 'invalid repo' }, { status: 400 })
  }

  return withEdgeCache(context, async () => {
    try {
      const data = await fetchHubJson(
        `${HUB_REPO_BASE}/${encodeURIComponent(repo)}/tags?page_size=100&ordering=-last_updated`,
      )
      return jsonResponse({ results: data.results || [] }, { cacheSeconds: 600 })
    } catch (err) {
      return jsonResponse(
        { error: String((err && err.message) || err) },
        { status: 502 },
      )
    }
  })
}

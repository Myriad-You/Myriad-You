/**
 * clearDedupCache 代际：旧飞行请求不得写回 resultCache
 * @vitest-environment node
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// 直接测模块行为：动态 import 后清缓存再 resolve 旧 promise
describe('requestDedup generation after clear', () => {
  it('does not re-cache stale data after clearDedupCache', async () => {
    const { dedupedFetch, clearDedupCache } = await import('./requestDedup')

    let resolveFetch!: (v: { n: number }) => void
    const slow = new Promise<{ n: number }>((resolve) => {
      resolveFetch = resolve
    })

    const key = '/api/config/ui-test-generation'
    const p1 = dedupedFetch(key, () => slow, { cacheTTL: 60_000, cacheKey: key })

    clearDedupCache(key)

    let resolveFresh!: (v: { n: number }) => void
    const fresh = new Promise<{ n: number }>((resolve) => {
      resolveFresh = resolve
    })
    const p2 = dedupedFetch(key, () => fresh, { cacheTTL: 60_000, cacheKey: key })

    resolveFetch({ n: 1 }) // 旧请求完成，不应污染缓存
    await p1.catch(() => {})

    resolveFresh({ n: 2 })
    const data = await p2
    assert.equal(data.n, 2)

    // 再读应命中 n=2，而非被旧请求写回的 n=1
    const cached = await dedupedFetch(
      key,
      async () => ({ n: 99 }),
      { cacheTTL: 60_000, cacheKey: key },
    )
    assert.equal(cached.n, 2)
  })
})

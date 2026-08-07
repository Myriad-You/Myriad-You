import { describe, expect, it } from 'vitest'
import { resolvePlatformId } from './platformId'

describe('resolvePlatformId', () => {
  it('maps display names and aliases to canonical ids', () => {
    expect(resolvePlatformId('GitHub')).toBe('github')
    expect(resolvePlatformId('MyAnimeList')).toBe('mal')
    expect(resolvePlatformId('Netease Music')).toBe('netease')
    expect(resolvePlatformId('PlayStation')).toBe('psn')
    expect(resolvePlatformId('X (Twitter)')).toBe('x')
    expect(resolvePlatformId('网易云音乐')).toBe('netease')
  })

  it('accepts already-canonical ids', () => {
    expect(resolvePlatformId('mal')).toBe('mal')
    expect(resolvePlatformId('psn')).toBe('psn')
    expect(resolvePlatformId('netease')).toBe('netease')
  })

  it('returns null for unknown platforms', () => {
    expect(resolvePlatformId('')).toBeNull()
    expect(resolvePlatformId('unknown-platform')).toBeNull()
  })
})

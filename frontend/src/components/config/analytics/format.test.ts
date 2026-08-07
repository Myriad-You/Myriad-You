import { describe, expect, it } from 'vitest'
import { formatCount, formatDuration, niceAxis, shortDay } from './format'

describe('formatCount', () => {
  it('returns em dash for non-finite', () => {
    expect(formatCount(Number.NaN, 'en-US')).toBe('—')
  })

  it('formats integers', () => {
    expect(formatCount(121, 'en-US')).toBe('121')
  })
})

describe('formatDuration', () => {
  it('returns em dash for zero or negative', () => {
    expect(formatDuration(0, 'zh-CN')).toBe('—')
    expect(formatDuration(-1, 'en-US')).toBe('—')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(4500, 'zh-CN')).toBe('5 秒')
    expect(formatDuration(4500, 'en-US')).toBe('5s')
  })

  it('formats minutes with remainder', () => {
    expect(formatDuration(125_000, 'zh-CN')).toBe('2 分 5 秒')
    expect(formatDuration(120_000, 'en-US')).toBe('2m')
  })
})

describe('shortDay', () => {
  it('strips year prefix', () => {
    expect(shortDay('2026-07-30')).toBe('07-30')
  })

  it('passes short values through', () => {
    expect(shortDay('07-30')).toBe('07-30')
  })
})

describe('niceAxis', () => {
  it('covers zero as a single unit max', () => {
    const axis = niceAxis(0)
    expect(axis.max).toBeGreaterThanOrEqual(1)
    expect(axis.ticks[0]).toBe(0)
    expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max)
  })

  it('produces integer ticks that cover the data', () => {
    const axis = niceAxis(47)
    expect(axis.max).toBeGreaterThanOrEqual(47)
    expect(axis.ticks.every((t) => Number.isInteger(t))).toBe(true)
    expect(axis.ticks.length).toBeGreaterThanOrEqual(3)
  })

  it('stays close for already-nice maxima', () => {
    const axis = niceAxis(100)
    expect(axis.max).toBe(100)
  })
})

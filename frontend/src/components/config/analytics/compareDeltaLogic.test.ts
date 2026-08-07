import { describe, expect, it } from 'vitest'
import {
  compareColorPalette,
  compareKindLabel,
  compareTone,
  formatComparePct,
  formatCompareValue,
  type CompareLabels,
} from './compareDeltaLogic'

const labels: CompareLabels = {
  day: '日环比',
  week: '周环比',
  month: '月环比',
  period: '较上期',
  new: '新',
  vsPrevious: '上期 {n}',
}

describe('compareDelta', () => {
  it('maps kind labels', () => {
    expect(compareKindLabel('day', labels)).toBe('日环比')
    expect(compareKindLabel('week', labels)).toBe('周环比')
    expect(compareKindLabel('month', labels)).toBe('月环比')
    expect(compareKindLabel('period', labels)).toBe('较上期')
    expect(compareKindLabel(undefined, labels)).toBe('较上期')
  })

  it('tones from pct', () => {
    expect(compareTone({ pct: 12 })).toBe('up')
    expect(compareTone({ pct: -3 })).toBe('down')
    expect(compareTone({ pct: 0 })).toBe('flat')
    expect(compareTone({ pct: null, current: 5 })).toBe('new')
    expect(compareTone({ pct: null, current: 0 })).toBe('flat')
    expect(compareTone(null)).toBe('none')
  })

  it('formats signed percent', () => {
    expect(formatComparePct(12.34, 'en-US')).toBe('+12.3%')
    expect(formatComparePct(-5, 'en-US')).toBe('−5%')
    expect(formatComparePct(0, 'en-US')).toBe('0%')
    expect(formatComparePct(null, 'en-US')).toBe('—')
  })

  it('formats value with new baseline', () => {
    expect(formatCompareValue({ pct: null, current: 3 }, 'zh-CN', labels)).toBe(
      '新',
    )
    expect(formatCompareValue({ pct: 10 }, 'zh-CN', labels)).toBe('+10%')
  })

  it('picks regional rise/fall color palette from locale', () => {
    expect(compareColorPalette('zh-CN')).toBe('red-up')
    expect(compareColorPalette('zh-TW')).toBe('red-up')
    expect(compareColorPalette('ja-JP')).toBe('red-up')
    expect(compareColorPalette('ko-KR')).toBe('red-up')
    expect(compareColorPalette('en-US')).toBe('green-up')
    expect(compareColorPalette('de-DE')).toBe('green-up')
  })
})

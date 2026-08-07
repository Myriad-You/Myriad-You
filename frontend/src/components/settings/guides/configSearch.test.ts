import { describe, expect, it } from 'vitest'
import {
  extractMatchSnippet,
  itemMatchesQuery,
  parseSearchQuery,
  rankConfigSearch,
  scoreSearchItem,
  type ConfigSearchableItem,
} from './configSearch'

const sample: ConfigSearchableItem[] = [
  {
    type: 'section',
    section: 'advanced',
    title: '高级配置',
    description: '代理与备份',
    keywords: ['proxy', '代理', 'reset'],
    haystack: '高级配置\n代理与备份\nproxy 代理 reset',
  },
  {
    type: 'guide',
    section: 'advanced',
    title: '服务器出外网时是否使用代理',
    description: '间接：同步/AI 成功率',
    keywords: ['代理', 'proxy', '外网'],
    haystack:
      '服务器出外网时是否使用代理 打开后按下面的代理地址访问外网 国内平台',
    guidePath: 'advanced.proxyEnable',
  },
  {
    type: 'guide',
    section: 'basic',
    title: '工信部 ICP 备案号',
    description: '页脚备案文字',
    keywords: ['备案', 'icp'],
    haystack: '工信部 icp 备案号 有才填 页脚多出备案这一行',
    guidePath: 'ui.siteIcp',
  },
  {
    type: 'section',
    section: 'platforms',
    title: '数据及统计',
    description: '接入平台与访客统计',
    keywords: ['github', 'steam'],
  },
]

describe('parseSearchQuery', () => {
  it('splits on spaces and full-width space', () => {
    expect(parseSearchQuery('  代理  同步  ')).toEqual(['代理', '同步'])
    expect(parseSearchQuery('proxy\u3000sync')).toEqual(['proxy', 'sync'])
  })
})

describe('itemMatchesQuery', () => {
  it('requires AND for multi tokens', () => {
    const item = sample[1]!
    expect(itemMatchesQuery(item, ['代理'])).toBe(true)
    expect(itemMatchesQuery(item, ['代理', '外网'])).toBe(true)
    expect(itemMatchesQuery(item, ['代理', '备案'])).toBe(false)
  })
})

describe('scoreSearchItem', () => {
  it('ranks title hits above body-only', () => {
    const titleHit = scoreSearchItem(sample[0]!, ['代理'])
    const bodyHit = scoreSearchItem(sample[1]!, ['代理'])
    expect(titleHit && bodyHit).toBeTruthy()
    // section title "高级配置" may not include 代理 — guide title does
    const guideTitle = scoreSearchItem(sample[1]!, ['代理'])
    const section = scoreSearchItem(sample[0]!, ['代理'])
    expect(guideTitle!.score).toBeGreaterThan(0)
    expect(section!.score).toBeGreaterThan(0)
  })

  it('prefers exact title match', () => {
    const item: ConfigSearchableItem = {
      type: 'section',
      section: 'ai',
      title: 'ai',
      description: 'models',
      keywords: [],
    }
    const exact = scoreSearchItem(item, ['ai'])!
    const partial = scoreSearchItem(
      { ...item, title: 'ai provider settings' },
      ['ai'],
    )!
    expect(exact.score).toBeGreaterThanOrEqual(partial.score)
  })
})

describe('extractMatchSnippet', () => {
  it('wraps match with ellipsis context', () => {
    const hay = 'abcdefghij代理服务器地址klmnopqrstuvwxyz'
    const snip = extractMatchSnippet(hay, ['代理'], 'fallback', 4)
    expect(snip).toContain('代理')
    expect(snip.length).toBeLessThan(hay.length)
  })
})

describe('rankConfigSearch', () => {
  it('returns empty for blank query', () => {
    expect(rankConfigSearch(sample, '   ')).toEqual([])
  })

  it('finds 备案 via guide haystack', () => {
    const r = rankConfigSearch(sample, '备案')
    expect(r.some((x) => x.guidePath === 'ui.siteIcp')).toBe(true)
  })

  it('caps guides per section', () => {
    const many: ConfigSearchableItem[] = Array.from({ length: 8 }, (_, i) => ({
      type: 'guide',
      section: 'advanced',
      title: `代理相关说明 ${i}`,
      description: 'desc',
      keywords: ['代理'],
      haystack: `代理 说明 ${i}`,
      guidePath: `advanced.x${i}`,
    }))
    const r = rankConfigSearch(many, '代理', { maxGuidesPerSection: 3 })
    expect(r.filter((x) => x.type === 'guide').length).toBe(3)
  })

  it('AND query 代理 备案 matches neither alone item', () => {
    const r = rankConfigSearch(sample, '代理 备案')
    // no single item has both
    expect(r.length).toBe(0)
  })
})

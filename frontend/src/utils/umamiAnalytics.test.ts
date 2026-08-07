/**
 * @vitest-environment node
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isValidUmamiScriptUrl,
  isValidUmamiWebsiteId,
  normalizeUmamiScriptUrl,
  normalizeUmamiWebsiteId,
} from './umamiAnalytics'

describe('umamiAnalytics', () => {
  it('normalizes website id', () => {
    assert.equal(
      normalizeUmamiWebsiteId('  94db1cb1-74f4-4a40-ad6c-962362670409  '),
      '94db1cb1-74f4-4a40-ad6c-962362670409',
    )
  })

  it('validates website ids', () => {
    assert.equal(
      isValidUmamiWebsiteId('94db1cb1-74f4-4a40-ad6c-962362670409'),
      true,
    )
    assert.equal(isValidUmamiWebsiteId('short'), false)
    assert.equal(isValidUmamiWebsiteId(''), false)
  })

  it('validates script urls', () => {
    assert.equal(
      isValidUmamiScriptUrl('https://cloud.umami.is/script.js'),
      true,
    )
    assert.equal(
      isValidUmamiScriptUrl('https://stats.example.com/umami.js'),
      true,
    )
    assert.equal(isValidUmamiScriptUrl('not-a-url'), false)
    assert.equal(isValidUmamiScriptUrl('ftp://x/script.js'), false)
  })

  it('rejects dangerous script url schemes', () => {
    assert.equal(isValidUmamiScriptUrl('javascript:alert(1)'), false)
    assert.equal(
      isValidUmamiScriptUrl('data:text/javascript,alert(1)'),
      false,
    )
    assert.equal(isValidUmamiScriptUrl('//evil.example/script.js'), false)
    assert.equal(isValidUmamiScriptUrl('vbscript:msgbox(1)'), false)
  })

  it('trims trailing slash on script url', () => {
    assert.equal(
      normalizeUmamiScriptUrl('https://cloud.umami.is/script.js/'),
      'https://cloud.umami.is/script.js',
    )
  })
})

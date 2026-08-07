/**
 * @vitest-environment node
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isValidGaMeasurementId,
  normalizeGaMeasurementId,
} from './googleAnalytics'

describe('googleAnalytics', () => {
  it('normalizes whitespace', () => {
    assert.equal(normalizeGaMeasurementId('  G-ABC123  '), 'G-ABC123')
    assert.equal(normalizeGaMeasurementId(undefined), '')
  })

  it('accepts GA4 and legacy UA ids', () => {
    assert.equal(isValidGaMeasurementId('G-XXXXXXXXXX'), true)
    assert.equal(isValidGaMeasurementId('G-AB12CD34EF'), true)
    assert.equal(isValidGaMeasurementId('UA-123456-1'), true)
    assert.equal(isValidGaMeasurementId('g-lower123'), true)
  })

  it('rejects empty and garbage', () => {
    assert.equal(isValidGaMeasurementId(''), false)
    assert.equal(isValidGaMeasurementId('GTM-XXXX'), false)
    assert.equal(isValidGaMeasurementId('not-an-id'), false)
    assert.equal(isValidGaMeasurementId('G-'), false)
  })
})

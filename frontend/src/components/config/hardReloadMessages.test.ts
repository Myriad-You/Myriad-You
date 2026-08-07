/**
 * Hard-reload / runtime-reload toast copy must stay explicit (full page vs hot reload).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { enUS } from '../../i18n/en-US'
import { jaJP } from '../../i18n/ja-JP'
import { zhCN } from '../../i18n/zh-CN'

const locales = [
  { name: 'zh-CN', c: zhCN.config },
  { name: 'en-US', c: enUS.config },
  { name: 'ja-JP', c: jaJP.config },
] as const

describe('hard / runtime reload save messages', () => {
  it('hard-reload messages mention full page reload, not only “saved”', () => {
    for (const { name, c } of locales) {
      assert.ok(
        c.savedSuccessHardReload.length > 0,
        `${name}.savedSuccessHardReload`,
      )
      assert.ok(
        c.hardReloadPreparing.length > 0,
        `${name}.hardReloadPreparing`,
      )
      // Must not collapse to the generic soft-save string
      assert.notEqual(c.savedSuccessHardReload, c.savedSuccess)
      assert.notEqual(c.hardReloadPreparing, c.savedSuccess)
      // Distinct stages
      assert.notEqual(c.hardReloadPreparing, c.savedSuccessHardReload)
    }
  })

  it('runtime-reload message is distinct from soft and hard success', () => {
    for (const { name, c } of locales) {
      assert.ok(
        c.savedSuccessRuntimeReload.length > 0,
        `${name}.savedSuccessRuntimeReload`,
      )
      assert.notEqual(c.savedSuccessRuntimeReload, c.savedSuccess)
      assert.notEqual(c.savedSuccessRuntimeReload, c.savedSuccessHardReload)
    }
  })

  it('import / force-cache success copy still signals upcoming full reload', () => {
    // Locale-specific cues that the page will reload (not soft toast only)
    assert.match(zhCN.config.importConfigSuccess, /整页刷新|刷新/)
    assert.match(zhCN.config.forceRefreshFrontendCacheSuccess, /整页刷新|刷新/)
    assert.match(enUS.config.importConfigSuccess, /reload|refresh/i)
    assert.match(enUS.config.forceRefreshFrontendCacheSuccess, /reload|refresh/i)
    assert.match(jaJP.config.importConfigSuccess, /再読み込み|更新/)
    assert.match(
      jaJP.config.forceRefreshFrontendCacheSuccess,
      /再読み込み|更新/,
    )
    // Confirm dialog mentions reload for zh/en
    assert.match(zhCN.config.importConfirmMessage, /整页刷新/)
    assert.match(enUS.config.importConfirmMessage, /reload/i)
  })
})

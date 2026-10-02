import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createContext, Script } from 'node:vm'
import { loadRemoteGenerator } from '../src/services/remoteGenerator.ts'
import { createGeneratorDocument } from '../src/tapp-runtime/bootstrap.ts'

const revision = '1234567890abcdef1234567890abcdef12345678'
const packageRoot = 'apps/com.myriad.config-generator/'
const commitUrl = 'https://api.github.com/repos/Myriad-You/tapp-store/commits/main'
const snapshotRoot = `https://raw.githubusercontent.com/Myriad-You/tapp-store/${revision}/`

function fixture() {
  const app = {
    id: 'com.myriad.config-generator',
    version: '1.0.6',
    download: {
      code: `${packageRoot}main.js`,
      page_template: `${packageRoot}page.html`,
      page_styles: `${packageRoot}page.css`,
      modules: {
        'lib/helper.js': `${packageRoot}lib/helper.js`,
        'shared.js': `${packageRoot}shared.js`,
      },
      i18n: {
        'zh-CN': `${packageRoot}i18n/zh-CN.json`,
        'en-US': `${packageRoot}i18n/en-US.json`,
        'ja-JP': `${packageRoot}i18n/ja-JP.json`,
      },
    },
  }
  return {
    commit: { sha: revision },
    index: { apps: [app] },
    manifest: {
      id: app.id,
      version: app.version,
      core: { entry: 'main.js' },
      page: { template: 'page.html', styles: 'page.css' },
      permissions: ['storage:read', 'ui:notification', 'ui:theme', 'ui:confirm', 'network:fetch'],
    },
    files: new Map([
      ['main.js', 'globalThis.__remoteSourceExecuted = true;'],
      ['page.html', '<main id="generator">Official generator fixture</main>'],
      ['page.css', 'main { color: inherit; }'],
      ['lib/helper.js', 'module.exports = { value: 42 };'],
      ['shared.js', 'exports.value = 42;'],
      ['i18n/zh-CN.json', { welcome: '你好 {name}' }],
      ['i18n/en-US.json', { welcome: 'Hello {name}' }],
      ['i18n/ja-JP.json', { welcome: 'こんにちは {name}' }],
    ]),
  }
}

function resource(fixture, url) {
  if (url === commitUrl) return fixture.commit
  if (url === `${snapshotRoot}index.json`) return fixture.index
  if (url === `${snapshotRoot + packageRoot}manifest.json`) return fixture.manifest
  const relative = url.slice((snapshotRoot + packageRoot).length)
  assert.ok(url.startsWith(snapshotRoot + packageRoot) && fixture.files.has(relative), 'Unexpected request outside the immutable fixture')
  return fixture.files.get(relative)
}

async function withFetch(fixture, callback, intercept) {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    calls.push({ url, options })
    if (options.signal.aborted) throw options.signal.reason
    if (intercept) {
      const response = await intercept(url, options)
      if (response) return response
    }
    const body = resource(fixture, url)
    return new Response(typeof body === 'string' ? body : JSON.stringify(body))
  }
  try {
    return await callback(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function runtimeBundle(overrides = {}) {
  return {
    version: '1.0.6',
    revision,
    entry: 'main.js',
    template: '<main>Generator</main>',
    styles: 'main { color: inherit; }',
    modules: { 'main.js': '' },
    translations: {
      'zh-CN': { welcome: '你好 {name}' },
      'en-US': { welcome: 'Hello {name}' },
      'ja-JP': { welcome: 'こんにちは {name}' },
    },
    ...overrides,
  }
}

function documentScript(document) {
  const scripts = [...document.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  assert.equal(scripts.length, 1, 'Exactly one bootstrap script may appear in srcdoc')
  return { attributes: scripts[0][1], source: scripts[0][2] }
}

function harness(bundle = runtimeBundle(), nativeFetch = async () => new Response('[]'), autoStart = true) {
  const messages = []
  const listeners = new Map()
  const documentListeners = new Map()
  const timers = new Map()
  const revoked = []
  const downloadNames = []
  let timerId = 0
  let blobId = 0
  let bootElementRemoved = false

  function node(tag) {
    const result = {
      tagName: tag,
      children: [],
      attributes: [],
      get childElementCount() { return this.children.length },
      get firstElementChild() { return this.children[0] },
      classList: { toggle() {} },
      style: { setProperty(name, value) { this[name] = value } },
      setAttribute(name, value) { this[name] = value },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child },
      remove() {
        const siblings = this.parentNode?.children
        const index = siblings?.indexOf(this) ?? -1
        if (index >= 0) siblings.splice(index, 1)
      },
      click() { downloadNames.push(this.download) },
    }
    if (tag === 'template') {
      // This harness supplies only a benign fragment; actual HTML parsing and CSP
      // enforcement remain browser checks rather than a simulated security claim.
      result.content = { fragment: true, querySelector: () => null, querySelectorAll: () => [] }
    }
    return result
  }

  const body = node('body')
  const head = node('head')
  const document = {
    body,
    head,
    documentElement: node('html'),
    currentScript: { remove() { bootElementRemoved = true } },
    createElement: node,
    getElementById(id) { return body.children.find(child => child.id === id) },
    querySelector: () => ({ remove() {} }),
    addEventListener(name, callback) {
      const callbacks = documentListeners.get(name) ?? []
      callbacks.push(callback)
      documentListeners.set(name, callbacks)
    },
  }
  const parent = { postMessage(message) { messages.push(message) } }
  const window = {
    parent,
    fetch: nativeFetch,
    addEventListener(name, callback) {
      const callbacks = listeners.get(name) ?? []
      callbacks.push(callback)
      listeners.set(name, callbacks)
    },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId },
    clearTimeout(id) { timers.delete(id) },
  }
  const context = createContext({
    window,
    document,
    navigator: {},
    AbortController,
    Blob,
    URL: {
      createObjectURL() { return `blob:fixture-${++blobId}` },
      revokeObjectURL(url) { revoked.push(url) },
    },
  })
  const script = documentScript(createGeneratorDocument(bundle, 'zh-CN', { primary: '#123456', dark: false }))
  new Script(script.source).runInContext(context, { timeout: 1000 })
  const start = () => {
    document.currentScript = null
    for (const [id, timer] of timers) {
      if (timer.delay !== 0) continue
      timers.delete(id)
      timer.callback()
    }
  }
  if (autoStart) start()
  return {
    window,
    document,
    messages,
    timers,
    revoked,
    downloadNames,
    bootElementRemoved: () => bootElementRemoved,
    start,
    dispatch(name, event = {}) { for (const callback of listeners.get(name) ?? []) callback(event) },
    dispatchDocument(name, event = {}) { for (const callback of documentListeners.get(name) ?? []) callback(event) },
  }
}

await test('loader pins the catalog, manifest, all modules, markup, CSS, and three locales to one SHA', async () => {
  await withFetch(fixture(), async calls => {
    const bundle = await loadRemoteGenerator(new AbortController().signal)
    assert.equal(bundle.revision, revision)
    assert.equal(bundle.version, '1.0.6')
    assert.equal(bundle.entry, 'main.js')
    assert.deepEqual(Object.keys(bundle.modules).sort(), ['lib/helper.js', 'main.js', 'shared.js'])
    assert.deepEqual(Object.keys(bundle.translations).sort(), ['en-US', 'ja-JP', 'zh-CN'])
    assert.equal(bundle.translations['en-US'].welcome, 'Hello {name}')
    assert.equal(calls.length, 11)
    assert.equal(calls[0].url, commitUrl)
    assert.ok(calls.slice(1).every(call => call.url.startsWith(snapshotRoot)))
    assert.ok(calls.every(call => call.options.credentials === 'omit' && call.options.referrerPolicy === 'no-referrer' && call.options.redirect === 'error'))
    assert.equal(globalThis.__remoteSourceExecuted, undefined, 'Downloading source must never evaluate it in the host')
  })
})

await test('a missing module rejects the entire package without evaluating downloaded source', async () => {
  let completed = false
  await withFetch(fixture(), async () => {
    await assert.rejects(async () => {
      await loadRemoteGenerator(new AbortController().signal)
      completed = true
    }, /Official generator request failed/)
    assert.equal(completed, false)
    assert.equal(globalThis.__remoteSourceExecuted, undefined)
  }, async url => url.endsWith('/lib/helper.js') ? new Response('', { status: 404 }) : undefined)
})

const metadataCases = [
  ['non-SHA revision', fixture => { fixture.commit.sha = 'main' }, /Invalid generator revision/, 1],
  ['manifest/catalog version mismatch', fixture => { fixture.manifest.version = '1.0.7' }, /manifest and catalog disagree/, 3],
  ['wrong manifest application', fixture => { fixture.manifest.id = 'com.example.other' }, /manifest and catalog disagree/, 3],
  ['unsupported permission', fixture => { fixture.manifest.permissions.push('storage:write') }, /unsupported runtime capability/, 3],
  ['package traversal', fixture => { fixture.index.apps[0].download.code = `${packageRoot}../outside.js` }, /Invalid generator file path/, 3],
  ['file outside the package', fixture => { fixture.index.apps[0].download.code = 'apps/com.example.other/main.js' }, /outside its package/, 3],
  ['module name/path mismatch', fixture => { fixture.index.apps[0].download.modules['lib/helper.js'] = `${packageRoot}shared.js` }, /Invalid generator modules/, 3],
  ['manifest/catalog entry mismatch', fixture => { fixture.manifest.page.template = 'different.html' }, /entry points disagree/, 3],
]
for (const [name, mutate, error, requestCount] of metadataCases) {
  await test(`loader rejects ${name} before fetching executable assets`, async () => {
    const data = fixture()
    mutate(data)
    await withFetch(data, async calls => {
      await assert.rejects(loadRemoteGenerator(new AbortController().signal), error)
      assert.equal(calls.length, requestCount)
      assert.equal(globalThis.__remoteSourceExecuted, undefined)
    })
  })
}

await test('loader rejects an invalid dictionary or oversized source without returning a partial bundle', async () => {
  const invalidTranslation = fixture()
  invalidTranslation.files.set('i18n/ja-JP.json', { welcome: { nested: 'unexpected' } })
  await withFetch(invalidTranslation, async () => {
    await assert.rejects(loadRemoteGenerator(new AbortController().signal), /Invalid generator translation/)
  })
  const oversized = fixture()
  oversized.files.set('main.js', ' '.repeat(2 * 1024 * 1024 + 1))
  await withFetch(oversized, async () => {
    await assert.rejects(loadRemoteGenerator(new AbortController().signal), /resource is too large/)
  })
})

await test('closing while an asset is loading aborts the propagated fetch signal and prevents a usable bundle', async () => {
  const controller = new AbortController()
  const started = Promise.withResolvers()
  let assetSignal
  await withFetch(fixture(), async () => {
    const loading = loadRemoteGenerator(controller.signal)
    const rejected = assert.rejects(loading, error => error.name === 'AbortError')
    await started.promise
    controller.abort()
    await rejected
    assert.equal(assetSignal.aborted, true)
    assert.equal(globalThis.__remoteSourceExecuted, undefined)
    await assert.rejects(loadRemoteGenerator(controller.signal), error => error.name === 'AbortError')
  }, async (url, options) => {
    if (!url.endsWith('/main.js')) return undefined
    assetSignal = options.signal
    started.resolve()
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
    })
  })
})

await test('srcdoc escapes hostile payload strings into one nonce script and remains valid JavaScript', () => {
  const hostile = '</ScRiPt><script>globalThis.injected = true</script><img src=x onerror=alert(1)>\u2028\u2029'
  const bundle = runtimeBundle({
    template: hostile,
    styles: hostile,
    modules: { 'main.js': `module.exports = ${JSON.stringify(hostile)}` },
    translations: { 'zh-CN': { hostile }, 'en-US': { hostile }, 'ja-JP': { hostile } },
  })
  const document = createGeneratorDocument(bundle, 'en-US', { primary: '#123456', dark: true })
  const script = documentScript(document)
  assert.equal((document.match(/<script\b/gi) ?? []).length, 1)
  assert.equal((document.match(/<\/script\s*>/gi) ?? []).length, 1)
  assert.ok(!script.source.includes('<script') && !script.source.includes('</ScRiPt>'))
  assert.ok(!script.source.includes('\u2028') && !script.source.includes('\u2029'))
  assert.match(script.source, /\\u003c/)
  assert.doesNotThrow(() => new Script(script.source))
  const nonce = /nonce="([a-f0-9]{36})"/.exec(script.attributes)?.[1]
  assert.ok(nonce)
  assert.ok(document.includes(`script-src 'nonce-${nonce}' 'unsafe-eval'`))
  const another = createGeneratorDocument(bundle, 'en-US', { primary: '#123456', dark: true })
  assert.notEqual(/<script nonce="([^"]+)"/.exec(another)?.[1], nonce)
})

await test('srcdoc CSP denies ambient resources and permits only the public query endpoints', () => {
  const document = createGeneratorDocument(runtimeBundle(), 'zh-CN', { primary: '#123456', dark: false })
  const content = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(document)?.[1]
  assert.ok(content)
  const directives = Object.fromEntries(content.split('; ').map(directive => {
    const [name, ...values] = directive.split(' ')
    return [name, values.join(' ')]
  }))
  for (const name of ['default-src', 'base-uri', 'object-src', 'frame-src', 'form-action', 'font-src', 'media-src', 'worker-src']) {
    assert.equal(directives[name], "'none'", `${name} must remain disabled`)
  }
  assert.equal(directives['img-src'], 'data: blob:')
  assert.equal(directives['connect-src'], 'https://api.github.com/repos/Myriad-You/Myriad/releases https://hub.docker.com/v2/repositories/somekawahitomi/')
  assert.match(directives['script-src'], /^'nonce-[a-f0-9]{36}' 'unsafe-eval'$/)
  assert.ok(!content.includes('https://raw.githubusercontent.com'), 'Remote scripts may only arrive as the verified payload')
})

await test('runtime loads relative CommonJS dependencies once, after markup, and reports ready without payload data', () => {
  const state = harness(runtimeBundle({
    modules: {
      'main.js': "const first = require('./lib/helper'); const second = require('./lib/helper.js'); Tapp.lifecycle.onReady(() => { window.result = { value: first.value, same: first === second, markup: document.body.children.some(node => node.fragment), greeting: Tapp.i18n.t('welcome', { name: 'Myriad' }), mode: window._TAPP_MODE, bootstrapRemoved: document.currentScript === null }; });",
      'lib/helper.js': "window.executions = (window.executions || 0) + 1; const shared = require('../shared'); module.exports = { value: shared.value };",
      'shared.js': 'exports.value = 42;',
    },
  }))
  assert.ok(state.window.result)
  assert.deepEqual({ ...state.window.result }, { value: 42, same: true, markup: true, greeting: '你好 Myriad', mode: 'page', bootstrapRemoved: true })
  assert.equal(state.window.executions, 1)
  assert.equal(state.bootElementRemoved(), true)
  assert.deepEqual(state.messages.map(message => ({ ...message })), [{ channel: 'myriad-generator-runtime', type: 'ready' }])
})

await test('runtime rejects arbitrary fetches, repositories, tags, and extra query parameters before networking', async () => {
  const calls = []
  const state = harness(runtimeBundle(), async (url, options) => {
    calls.push({ url, options })
    return new Response('{"ok":true}')
  })
  const api = state.window.Tapp.api
  for (const [name, params] of [
    ['unknown', {}],
    ['githubReleases', { token: 'unused' }],
    ['dockerHubTags', { repo: 'other-repository' }],
    ['dockerHubTags', { repo: 'myriad-backend', tag: 'v0.6.1' }],
    ['dockerHubTag', { repo: 'myriad-backend', tag: '../private' }],
    ['dockerHubTag', { repo: 'myriad-backend', tag: 'v0.6.1', host: 'example.com' }],
  ]) {
    await assert.rejects(api(name, params), /PUBLIC_QUERY_NOT_ALLOWED/)
  }
  await assert.rejects(state.window.fetch('https://example.com'), /PUBLIC_QUERY_NOT_ALLOWED/)
  assert.throws(() => state.window.WebSocket('wss://example.com'), /PUBLIC_QUERY_NOT_ALLOWED/)
  assert.equal(calls.length, 0)
  await api('githubReleases')
  await api('dockerHubTags', { repo: 'myriad-backend' })
  await api('dockerHubTag', { repo: 'myriad-proxy', tag: 'v0.6.1' })
  assert.deepEqual(calls.map(call => call.url), [
    'https://api.github.com/repos/Myriad-You/Myriad/releases?per_page=20',
    'https://hub.docker.com/v2/repositories/somekawahitomi/myriad-backend/tags?page_size=100&ordering=-last_updated',
    'https://hub.docker.com/v2/repositories/somekawahitomi/myriad-proxy/tags/v0.6.1',
  ])
  assert.ok(calls.every(call => call.options.method === 'GET' && call.options.credentials === 'omit' && call.options.redirect === 'error' && call.options.referrerPolicy === 'no-referrer'))
})

await test('runtime pagehide aborts pending requests, revokes downloads, and disposes handlers exactly once', async () => {
  let signal
  let calls = 0
  const state = harness(runtimeBundle({
    modules: { 'main.js': 'Tapp.lifecycle.onUnload(() => { window.unloads = (window.unloads || 0) + 1; });' },
  }), async (url, options) => {
    calls++
    signal = options.signal
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  })
  const pending = state.window.Tapp.api('githubReleases')
  const rejected = assert.rejects(pending, /PUBLIC_QUERY_FAILED/)
  await state.window.Tapp.file.download('fixture only', '../compose.yml')
  assert.deepEqual(state.downloadNames, ['.._compose.yml'])
  state.dispatch('pagehide')
  state.dispatch('pagehide')
  await rejected
  assert.equal(signal.aborted, true)
  assert.equal(state.window.unloads, 1)
  assert.deepEqual(state.revoked, ['blob:fixture-1'])
  await assert.rejects(state.window.Tapp.api('githubReleases'), /PUBLIC_QUERY_NOT_ALLOWED/)
  await assert.rejects(state.window.Tapp.file.download('fixture only', 'compose.yml'), /RUNTIME_UNAVAILABLE/)
  assert.equal(calls, 1)
})

await test('runtime accepts appearance only from the parent and updates locale without rerunning code', () => {
  const state = harness(runtimeBundle({
    modules: { 'main.js': "window.executions = (window.executions || 0) + 1; Tapp.ui.onLocaleChange(locale => { window.lastLocale = locale; });" },
  }))
  const appearance = { channel: 'myriad-generator-runtime', type: 'appearance', locale: 'ja-JP', primary: '#abcdef', dark: true }
  state.dispatch('message', { source: {}, data: appearance })
  state.dispatch('message', { source: state.window.parent, data: { ...appearance, channel: 'other' } })
  state.dispatch('message', { source: state.window.parent, data: { ...appearance, primary: 'url(https://example.com)' } })
  assert.equal(state.window.Tapp.i18n.getLocale(), 'zh-CN')
  state.dispatch('message', { source: state.window.parent, data: appearance })
  assert.equal(state.window.Tapp.i18n.getLocale(), 'ja-JP')
  assert.equal(state.window.lastLocale, 'ja-JP')
  assert.equal(state.document.documentElement.style['--color-primary'], '#abcdef')
  assert.equal(state.window.executions, 1)
})

for (const source of [
  "throw new Error('CONFIGURATION_SENTINEL');",
  "require('../outside.js');",
  "require('node:fs');",
]) {
  await test('runtime reports a fixed error once for failed or forbidden module execution', () => {
    const state = harness(runtimeBundle({ modules: { 'main.js': source } }))
    assert.equal(state.messages.length, 1, 'Module failure must report before unrelated window errors')
    state.dispatch('error')
    state.dispatch('unhandledrejection')
    assert.deepEqual(state.messages.map(message => ({ ...message })), [
      { channel: 'myriad-generator-runtime', type: 'error', message: 'GENERATOR_RUNTIME_FAILED' },
    ])
    assert.ok(!JSON.stringify(state.messages).includes('CONFIGURATION_SENTINEL'))
  })
}

await test('closing before deferred module startup invalidates the runtime without executing source', () => {
  const state = harness(runtimeBundle({ modules: { 'main.js': 'window.executedAfterClose = true;' } }), undefined, false)
  state.dispatch('pagehide')
  state.start()
  assert.equal(state.window.executedAfterClose, undefined)
  assert.equal(state.messages.length, 0)
})

await test('Escape requests closing with only channel/type, prevents default, and stops after disposal', () => {
  const state = harness()
  let prevented = 0
  const event = {
    key: 'Escape',
    target: { value: 'CONFIGURATION_SENTINEL' },
    formData: { imported: 'CONFIGURATION_SENTINEL' },
    preventDefault() { prevented++ },
  }
  state.dispatchDocument('keydown', { ...event, key: 'Enter' })
  assert.equal(prevented, 0)
  assert.equal(state.messages.length, 1)
  state.dispatchDocument('keydown', event)
  assert.equal(prevented, 1)
  assert.deepEqual(state.messages.map(message => ({ ...message })), [
    { channel: 'myriad-generator-runtime', type: 'ready' },
    { channel: 'myriad-generator-runtime', type: 'close' },
  ])
  assert.ok(!JSON.stringify(state.messages).includes('CONFIGURATION_SENTINEL'))
  state.dispatch('pagehide')
  state.dispatchDocument('keydown', event)
  assert.equal(state.messages.length, 2)
  assert.equal(prevented, 1)
})

for (const [locale, expectedMessage] of [
  ['zh-CN', '操作未能完成，请重试。'],
  ['en-US', 'The operation could not be completed. Please try again.'],
  ['ja-JP', '操作を完了できませんでした。もう一度お試しください。'],
]) {
  await test(`errors after startup remain inside the form with a generic ${locale} notification`, () => {
    const state = harness()
    state.dispatch('message', {
      source: state.window.parent,
      data: { channel: 'myriad-generator-runtime', type: 'appearance', locale, primary: '#abcdef', dark: false },
    })
    const fragment = state.document.body.children.find(child => child.fragment)
    const failure = {
      message: 'CONFIGURATION_SENTINEL',
      error: new Error('CONFIGURATION_SENTINEL'),
      reason: new Error('CONFIGURATION_SENTINEL'),
    }
    state.dispatch('error', failure)
    state.dispatch('unhandledrejection', failure)
    assert.deepEqual(state.messages.map(message => ({ ...message })), [
      { channel: 'myriad-generator-runtime', type: 'ready' },
    ])
    const notifications = state.document.getElementById('runtime-notifications')
    assert.equal(notifications.children.length, 2)
    assert.deepEqual(notifications.children.map(child => child.textContent), [expectedMessage, expectedMessage])
    assert.ok(notifications.children.every(child => child.role === 'alert'))
    assert.ok(state.document.body.children.includes(fragment), 'A later error must retain the form fragment')
    assert.ok(!notifications.children.some(child => child.textContent.includes('CONFIGURATION_SENTINEL')))
    state.dispatch('pagehide')
    state.dispatch('error', failure)
    assert.equal(notifications.children.length, 2)
  })
}

await test('an onReady exception is a startup failure even after the ready flag is set', () => {
  const state = harness(runtimeBundle({
    modules: { 'main.js': "Tapp.lifecycle.onReady(() => { throw new Error('CONFIGURATION_SENTINEL'); });" },
  }))
  state.dispatch('error', { message: 'CONFIGURATION_SENTINEL' })
  state.dispatch('unhandledrejection', { reason: 'CONFIGURATION_SENTINEL' })
  assert.deepEqual(state.messages.map(message => ({ ...message })), [
    { channel: 'myriad-generator-runtime', type: 'error', message: 'GENERATOR_RUNTIME_FAILED' },
  ])
  assert.equal(state.document.getElementById('runtime-notifications').children.length, 0)
  assert.ok(!JSON.stringify(state.messages).includes('CONFIGURATION_SENTINEL'))
})

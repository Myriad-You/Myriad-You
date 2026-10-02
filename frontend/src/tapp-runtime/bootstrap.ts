import type { Locale } from '../i18n'
import type { RemoteGeneratorBundle } from '../services/remoteGenerator'

interface RuntimeTheme {
  primary: string
  dark: boolean
}

interface RuntimePayload {
  bundle: RemoteGeneratorBundle
  locale: Locale
  theme: RuntimeTheme
}

/** This function is serialized, then executed only in an opaque sandboxed iframe. */
function bootGenerator(payload: RuntimePayload): void {
  const channel = 'myriad-generator-runtime'
  const nativeFetch = window.fetch.bind(window)
  const readyHandlers = new Set<() => unknown>()
  const unloadHandlers = new Set<() => unknown>()
  const localeHandlers = new Set<(locale: Locale) => unknown>()
  const requests = new Set<AbortController>()
  const downloads = new Set<string>()
  const modules = new Map<string, { exports: unknown }>()
  const locales: readonly string[] = ['zh-CN', 'en-US', 'ja-JP']
  const runtimeErrorMessages: Record<Locale, string> = {
    'zh-CN': '操作未能完成，请重试。',
    'en-US': 'The operation could not be completed. Please try again.',
    'ja-JP': '操作を完了できませんでした。もう一度お試しください。',
  }
  const repositories = new Set(['myriad-backend', 'myriad-frontend', 'myriad-proxy', 'myriad-updater'])
  let locale: Locale = locales.includes(payload.locale) ? payload.locale : 'zh-CN'
  let ready = false
  let started = false
  let disposed = false
  let reportedError = false

  function reportError(): void {
    if (disposed) return
    if (started) {
      void showNotification({ message: runtimeErrorMessages[locale], type: 'error' })
      return
    }
    if (reportedError) return
    reportedError = true
    window.parent.postMessage({ channel, type: 'error', message: 'GENERATOR_RUNTIME_FAILED' }, '*')
  }

  // Exception details may contain imported configuration. They never leave the iframe.
  window.addEventListener('error', reportError)
  window.addEventListener('unhandledrejection', reportError)
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (disposed || event.key !== 'Escape') return
    event.preventDefault()
    window.parent.postMessage({ channel, type: 'close' }, '*')
  })

  function appearance(nextLocale: Locale, primary: string, dark: boolean): void {
    const root = document.documentElement
    const color = /^#[\da-f]{6}$/i.test(primary) ? primary : '#7c6ee6'
    root.lang = nextLocale
    root.classList.toggle('dark', dark)
    document.body.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    root.style.setProperty('--tapp-primary', color)
    root.style.setProperty('--tapp-primary-rgb', [1, 3, 5].map(
      start => Number.parseInt(color.slice(start, start + 2), 16),
    ).join(', '))
    root.style.setProperty('--color-primary', color)
    root.style.setProperty('--bg-primary', dark ? '#101014' : '#f6f7fb')
    root.style.setProperty('--tapp-bg', dark ? '#101014' : '#f6f7fb')
    root.style.setProperty('--text-primary', dark ? '#f3f4f6' : '#171923')
    root.style.setProperty('--text-secondary', dark ? '#9ca3af' : '#667085')
    const changed = locale !== nextLocale
    locale = nextLocale
    if (changed && ready) {
      for (const callback of localeHandlers) {
        try { callback(locale) } catch { reportError() }
      }
    }
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const data: unknown = event.data
    if (event.source !== window.parent || !data || typeof data !== 'object') return
    const message = data as Record<string, unknown>
    if (message.channel !== channel || message.type !== 'appearance' ||
      typeof message.locale !== 'string' || !locales.includes(message.locale) ||
      typeof message.primary !== 'string' || !/^#[\da-f]{6}$/i.test(message.primary) ||
      typeof message.dark !== 'boolean') {
      return
    }
    appearance(message.locale as Locale, message.primary, message.dark)
  })

  function t(key: string, params: Record<string, unknown> = {}): string {
    const dictionary = payload.bundle.translations[locale] || payload.bundle.translations['zh-CN'] || {}
    let value = Object.hasOwn(dictionary, key) ? dictionary[key] : key
    if (typeof value !== 'string') value = key
    for (const name of Object.keys(params)) {
      value = value.split(`{${name}}`).join(String(params[name]))
    }
    return value
  }

  async function api(name: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (disposed || !params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('PUBLIC_QUERY_NOT_ALLOWED')
    }
    const keys = Object.keys(params)
    let url: string
    if (name === 'githubReleases' && keys.length === 0) {
      url = 'https://api.github.com/repos/Myriad-You/Myriad/releases?per_page=20'
    } else if ((name === 'dockerHubTags' || name === 'dockerHubTag') &&
      typeof params.repo === 'string' && repositories.has(params.repo) &&
      keys.every(key => key === 'repo' || (name === 'dockerHubTag' && key === 'tag'))) {
      url = `https://hub.docker.com/v2/repositories/somekawahitomi/${params.repo}/tags`
      if (name === 'dockerHubTags') {
        url += '?page_size=100&ordering=-last_updated'
      } else {
        if (typeof params.tag !== 'string' || !/^\w[\w.-]{0,127}$/.test(params.tag)) {
          throw new Error('PUBLIC_QUERY_NOT_ALLOWED')
        }
        url += `/${encodeURIComponent(params.tag)}`
      }
    } else {
      throw new Error('PUBLIC_QUERY_NOT_ALLOWED')
    }
    const controller = new AbortController()
    requests.add(controller)
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    try {
      const response = await nativeFetch(url, {
        method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { Accept: name === 'githubReleases' ? 'application/vnd.github+json' : 'application/json' },
      })
      if (!response.ok) throw new Error('PUBLIC_QUERY_FAILED')
      const text = await response.text()
      if (text.length > 2 * 1024 * 1024) throw new Error('PUBLIC_QUERY_FAILED')
      return JSON.parse(text) as unknown
    } catch {
      throw new Error('PUBLIC_QUERY_FAILED')
    } finally {
      window.clearTimeout(timeout)
      requests.delete(controller)
    }
  }

  async function download(content: string | Blob, filename: string): Promise<void> {
    if (disposed) throw new Error('RUNTIME_UNAVAILABLE')
    const safeName = String(filename).replace(/[\\/\x00-\x1F<>:"|?*]/g, '_').slice(0, 200) || 'myriad-config.txt'
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    downloads.add(url)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeName
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      downloads.delete(url)
    }, 30000)
  }

  async function showNotification(notification: { title?: string; message?: string; type?: string }): Promise<void> {
    if (disposed) return
    const toast = document.createElement('div')
    toast.className = 'runtime-toast'
    toast.setAttribute('role', notification.type === 'error' ? 'alert' : 'status')
    toast.textContent = [notification.title, notification.message].filter(value => typeof value === 'string').join(': ')
    const holder = document.getElementById('runtime-notifications')
    if (!holder) return
    if (holder.childElementCount >= 4) holder.firstElementChild?.remove()
    holder.appendChild(toast)
    window.setTimeout(() => toast.remove(), 4000)
  }

  function register<T>(handlers: Set<T>, callback: T): () => void {
    if (typeof callback === 'function' && !disposed) handlers.add(callback)
    return () => { handlers.delete(callback) }
  }

  const Tapp = Object.freeze({
    api,
    i18n: Object.freeze({ t, getLocale: () => locale }),
    ui: Object.freeze({ showNotification, onLocaleChange: (callback: (value: Locale) => unknown) => register(localeHandlers, callback) }),
    file: Object.freeze({ download }),
    lifecycle: Object.freeze({
      onReady(callback: () => unknown) {
        if (ready && !disposed) {
          Promise.resolve().then(callback).catch(reportError)
          return () => undefined
        }
        return register(readyHandlers, callback)
      },
      onUnload: (callback: () => unknown) => register(unloadHandlers, callback),
      onDestroy: (callback: () => unknown) => register(unloadHandlers, callback),
    }),
  })
  Object.defineProperty(window, 'Tapp', { value: Tapp, writable: false, configurable: false })
  Object.defineProperty(window, '_TAPP_MODE', { value: 'page', writable: false, configurable: false })
  Object.defineProperty(window, '_TAPP_HAS_HTML', { value: true, writable: false, configurable: false })

  // Only Tapp.api owns the saved fetch function. No general-purpose network API is exposed.
  const denyNetwork = () => { throw new Error('PUBLIC_QUERY_NOT_ALLOWED') }
  Object.defineProperty(window, 'fetch', {
    value: () => Promise.reject(new Error('PUBLIC_QUERY_NOT_ALLOWED')), writable: false, configurable: false,
  })
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'RTCPeerConnection', 'webkitRTCPeerConnection']) {
    try { Object.defineProperty(window, name, { value: denyNetwork, writable: false, configurable: false }) } catch { /* CSP remains enforced. */ }
  }
  try { Object.defineProperty(navigator, 'sendBeacon', { value: () => false, writable: false, configurable: false }) } catch { /* CSP remains enforced. */ }

  function resolveModule(request: string, from: string): string {
    if (!/^\.\.?\//.test(request) || /[\\\x00-\x1F]/.test(request)) throw new Error('MODULE_NOT_ALLOWED')
    const path = from.split('/').slice(0, -1)
    for (const segment of request.split('/')) {
      if (segment === '.' || !segment) continue
      if (segment === '..') {
        if (!path.length) throw new Error('MODULE_NOT_ALLOWED')
        path.pop()
      } else {
        path.push(segment)
      }
    }
    const resolved = path.join('/')
    return Object.hasOwn(payload.bundle.modules, resolved) ? resolved : `${resolved}.js`
  }

  function requireModule(path: string): unknown {
    if (!/^[\w./-]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..') ||
      !Object.hasOwn(payload.bundle.modules, path)) {
      throw new Error('MODULE_NOT_ALLOWED')
    }
    const cached = modules.get(path)
    if (cached) return cached.exports
    const module = { exports: Object.create(null) as unknown }
    modules.set(path, module)
    // CommonJS evaluation is confined to this iframe, never the parent window.
    // eslint-disable-next-line no-new-func
    const execute = new Function('require', 'module', 'exports', 'Tapp',
      `${payload.bundle.modules[path]}\n//# sourceURL=myriad-generator/${path}`)
    execute((request: string) => requireModule(resolveModule(request, path)), module, module.exports, Tapp)
    return module.exports
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    for (const callback of unloadHandlers) {
      try { callback() } catch { /* Never expose unload errors or configuration. */ }
    }
    for (const request of requests) request.abort()
    for (const url of downloads) URL.revokeObjectURL(url)
    requests.clear()
    downloads.clear()
    readyHandlers.clear()
    unloadHandlers.clear()
    localeHandlers.clear()
    modules.clear()
  }
  window.addEventListener('pagehide', dispose, { once: true })

  try {
    const template = document.createElement('template')
    template.innerHTML = payload.bundle.template
    if (template.content.querySelector('script,iframe,object,embed,base,link,meta')) throw new Error('TEMPLATE_NOT_ALLOWED')
    for (const node of template.content.querySelectorAll('*')) {
      for (const attribute of node.attributes) {
        if (/^on/i.test(attribute.name)) throw new Error('TEMPLATE_NOT_ALLOWED')
      }
    }
    const style = document.createElement('style')
    style.textContent = payload.bundle.styles
    document.head.appendChild(style)
    document.body.appendChild(template.content)
    const notifications = document.createElement('div')
    notifications.id = 'runtime-notifications'
    notifications.setAttribute('aria-live', 'polite')
    document.body.appendChild(notifications)
    // Retain no nonce-bearing bootstrap element before evaluating the remote module.
    document.currentScript?.remove()
    document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove()
    appearance(locale, payload.theme.primary, payload.theme.dark)
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('a') : null
      if (target && !(target.download && downloads.has(target.href))) event.preventDefault()
    }, true)
    // Start in a new task so document.currentScript cannot reveal the removed nonce.
    window.setTimeout(() => {
      if (disposed) return
      try {
        requireModule(payload.bundle.entry)
        ready = true
        for (const callback of readyHandlers) callback()
        readyHandlers.clear()
        started = true
        window.parent.postMessage({ channel, type: 'ready' }, '*')
      } catch {
        reportError()
      }
    }, 0)
  } catch {
    reportError()
  }
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

/** Caller must use sandbox="allow-scripts allow-downloads" without allow-same-origin. */
export function createGeneratorDocument(bundle: RemoteGeneratorBundle, locale: Locale, theme: RuntimeTheme): string {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(18)), value => value.toString(16).padStart(2, '0')).join('')
  const policy = [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'",
    `script-src 'nonce-${nonce}' 'unsafe-eval'`, "style-src 'unsafe-inline'", "img-src data: blob:",
    'connect-src https://api.github.com/repos/Myriad-You/Myriad/releases https://hub.docker.com/v2/repositories/somekawahitomi/',
    "font-src 'none'", "media-src 'none'", "worker-src 'none'",
  ].join('; ')
  const bootstrap = `(${bootGenerator.toString()})(${scriptJson({ bundle, locale, theme })});`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta http-equiv="Content-Security-Policy" content="${policy}">` +
    `<meta name="referrer" content="no-referrer"><title>Myriad Config Generator</title>` +
    `<style>*,*::before,*::after{box-sizing:border-box}button,input,textarea,select{font:inherit}` +
    `html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}` +
    `body{background:var(--bg-primary,#f6f7fb);color:var(--text-primary,#171923)}` +
    `#runtime-notifications{position:fixed;bottom:20px;right:20px;z-index:10000;display:grid;gap:8px;max-width:min(360px,calc(100vw - 40px));pointer-events:none}` +
    `.runtime-toast{padding:12px 16px;border-radius:12px;background:var(--text-primary,#171923);color:var(--bg-primary,#f6f7fb);box-shadow:0 8px 32px #0002;overflow-wrap:anywhere}</style>` +
    `</head><body><script nonce="${nonce}">${bootstrap.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
}

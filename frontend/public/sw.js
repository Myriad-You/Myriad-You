// Service Worker for Myriad
// 性能优化版 - 缓存策略 + 安全过滤 + 206 响应处理
// 当前缓存策略不缓存壁纸图片，避免跨域问题

// v2.4: 壁纸 CDN / 跨域图片不再被 SW 用 mode:cors 劫持（无 ACAO 时生产会拿到空 blob，
// 开发环境无 SW 则正常 —— 表现为「仅生产壁纸/动效异常」）
const CACHE_VERSION = 'myriad-v2.4'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

// 需要预缓存的静态资源
const STATIC_ASSETS = ['/', '/logo.webp']

// 缓存配置
const MAX_DYNAMIC_CACHE_SIZE = 50
// Must exceed the app's own icon set (~64 files) or the LRU eviction thrashes:
// icons get evicted then re-downloaded on the next screen. Headroom left for
// dynamic images (avatars, thumbnails) sharing this cache.
const MAX_IMAGE_CACHE_SIZE = 200
const CACHE_MAX_AGE = {
  static: 30 * 24 * 60 * 60 * 1000, // 30天
  images: 7 * 24 * 60 * 60 * 1000, // 7天
  wallpaper: 24 * 60 * 60 * 1000, // 壁纸缓存1天（可能是动态API）
  api: 5 * 60 * 1000, // 5分钟
}

// 壁纸 CDN 域名列表（优先缓存）
const WALLPAPER_CDN_DOMAINS = [
  'nmxc.ltd',
  's.nmxc.ltd',
  'picsum.photos',
  'unsplash.com',
  'source.unsplash.com',
]

// 安装 Service Worker
globalThis.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .catch((err) => {
        console.error('[SW] Precache failed:', err)
      }),
  )

  // 强制激活新的 Service Worker
  globalThis.skipWaiting()
})

// 激活 Service Worker 并清理旧缓存
globalThis.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('myriad-') &&
              key !== STATIC_CACHE &&
              key !== DYNAMIC_CACHE &&
              key !== IMAGE_CACHE,
          )
          .map((key) => {
            console.log('[SW] Removing old cache:', key)
            return caches.delete(key)
          }),
      )
    }),
  )

  // 立即控制所有客户端
  return globalThis.clients.claim()
})

// 限制缓存大小
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize)
    await Promise.all(keysToDelete.map((key) => cache.delete(key)))
  }
}

// 检查缓存是否过期
function isCacheExpired(response, maxAge) {
  const cachedDate = response.headers.get('sw-cached-date')
  if (!cachedDate) return false

  const cacheTime = new Date(cachedDate).getTime()
  const now = Date.now()
  return now - cacheTime > maxAge
}

// 添加缓存时间戳
async function cacheWithTimestamp(cacheName, request, response) {
  // ✅ 跳过 206 Partial Content 响应（Cache API 不支持）
  if (response.status === 206) {
    console.log('[SW] Skipping cache for 206 response:', request.url)
    return
  }

  const cache = await caches.open(cacheName)
  const headers = new Headers(response.headers)
  headers.set('sw-cached-date', new Date().toISOString())

  const blob = await response.blob()
  const cachedResponse = new Response(blob, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })

  await cache.put(request, cachedResponse)
}

// 拦截请求
globalThis.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 HTTP(S) 请求（包括 blob: 和 data: URL）
  if (!url.protocol.startsWith('http')) {
    return
  }

  // 跳过 blob: URL（由浏览器直接处理）
  if (request.url.startsWith('blob:')) {
    return
  }

  // 跳过 blob: URL（由浏览器直接处理）
  if (request.url.startsWith('blob:')) {
    return
  }

  // 跳过 blob: URL（由浏览器直接处理）
  if (request.url.startsWith('blob:')) {
    return
  }

  // 跳过 blob: URL（由浏览器直接处理）
  if (request.url.startsWith('blob:')) {
    return
  }

  // API 请求 - 网络优先策略
  if (url.pathname.startsWith('/api/')) {
    // API responses are live application state. Let the browser hit the
    // network directly so auth, proxy errors, and backend restarts stay honest.
    return
  }

  // 图片请求 - 缓存优先策略(带过期检查)
  // ⚠️ 壁纸 CDN：完全不拦截，交给浏览器（CSS background 可用 no-cors 显示）
  if (
    request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(url.pathname)
  ) {
    const isWallpaperCDN = WALLPAPER_CDN_DOMAINS.some((domain) =>
      url.hostname.includes(domain),
    )

    // 壁纸 CDN 不接管：强制 cors 会在无 ACAO 时失败并用空 blob「顶替」，
    // 仅生产注册 SW，开发无此问题。
    if (isWallpaperCDN) {
      return
    }

    // 跨域图片且浏览器以 no-cors 发起时，不要改 mode（改 cors 会同样失败）
    if (request.mode === 'no-cors') {
      return
    }

    const cacheMaxAge = CACHE_MAX_AGE.images

    event.respondWith(
      caches.match(request).then(async (cachedResponse) => {
        // 检查缓存是否过期
        if (cachedResponse && !isCacheExpired(cachedResponse, cacheMaxAge)) {
          return cachedResponse
        }

        try {
          // 保持原始 request（含 mode / credentials），勿强制 cors
          const response = await fetch(request)

          if (response.ok && response.status !== 206) {
            const responseClone = response.clone()
            await cacheWithTimestamp(IMAGE_CACHE, request, responseClone)
            limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE)
          }
          return response
        } catch (error) {
          // 网络失败时返回过期缓存
          if (cachedResponse) {
            console.log(
              '[SW] Using cached image after network error:',
              request.url,
            )
            return cachedResponse
          }
          console.warn('[SW] Image fetch failed:', request.url, error)
          // 勿返回空 200 blob（会掩盖失败并搞坏 background-image）
          return Response.error()
        }
      }),
    )
    return
  }

  // CSS/JS静态资源 - 缓存优先(带过期检查)
  if (/\.(css|js|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(async (cachedResponse) => {
        if (
          cachedResponse &&
          !isCacheExpired(cachedResponse, CACHE_MAX_AGE.static)
        ) {
          return cachedResponse
        }

        try {
          const response = await fetch(request)
          if (response.ok) {
            const responseClone = response.clone()
            await cacheWithTimestamp(STATIC_CACHE, request, responseClone)
          }
          return response
        } catch (error) {
          if (cachedResponse) {
            return cachedResponse
          }
          throw error
        }
      }),
    )
    return
  }

  // 其他请求 - 网络优先,缓存回退
  event.respondWith(
    fetch(request)
      .then((response) => {
        // ✅ 只缓存成功的 GET 请求（排除 206 响应）
        if (
          request.method === 'GET' &&
          response.ok &&
          response.status !== 206
        ) {
          const responseClone = response.clone()
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone)
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          // 导航请求失败返回首页
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          throw new Error('Network failed and no cache available')
        })
      }),
  )
})

// 消息处理
globalThis.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    globalThis.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => caches.keys())
        // 二次确认：尽量清空所有 Cache Storage 桶
        .then((remaining) =>
          Promise.all(remaining.map((key) => caches.delete(key))),
        )
        .then(() => {
          try {
            event.ports?.[0]?.postMessage({ success: true })
          } catch {
            // port 可能已关闭
          }
        })
        .catch(() => {
          try {
            event.ports?.[0]?.postMessage({ success: false })
          } catch {
            // ignore
          }
        }),
    )
  }
})

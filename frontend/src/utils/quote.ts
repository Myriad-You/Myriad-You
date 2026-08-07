import { API_URL } from '../config'
import apiService from '../services/api'

export interface QuoteData {
  text: string
  author?: string
}

/** 一言源定义 */
export interface HitokotoSource {
  /** 源 ID */
  id: string
  /** API 地址（自定义源为用户填写） */
  url: string
  /** JSON 响应中一言正文对应的字段名 */
  textField: string
  /** JSON 响应中出处/作者对应的字段名（可选） */
  authorField?: string
}

/** 内置一言源（含其他语言） */
export const BUILTIN_HITOKOTO_SOURCES: Record<string, HitokotoSource> = {
  // 中文 · 一言 hitokoto.cn（文学/诗词/哲学）
  'hitokoto-cn': {
    id: 'hitokoto-cn',
    url: 'https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json',
    textField: 'hitokoto',
    authorField: 'from',
  },
  // 中文 · 动漫/漫画语录
  'hitokoto-anime': {
    id: 'hitokoto-anime',
    url: 'https://v1.hitokoto.cn/?c=a&c=b&encode=json',
    textField: 'hitokoto',
    authorField: 'from',
  },
  // English · Quotable 名言
  'quotable-en': {
    id: 'quotable-en',
    url: 'https://api.quotable.io/random',
    textField: 'content',
    authorField: 'author',
  },
  // 日本語 · 名言（meigen，返回数组）
  'meigen-ja': {
    id: 'meigen-ja',
    url: 'https://meigen.doodlenote.net/api/json.php',
    textField: 'meigen',
    authorField: 'auther',
  },
}

/** 默认一言源 ID */
export const DEFAULT_HITOKOTO_SOURCE_ID = 'hitokoto-cn'

/** 一言配置（存储于后端数据库，随全局保存流程持久化） */
export interface HitokotoConfig {
  /** 选中的源 ID，或 'custom' 表示自定义 */
  sourceId: string
  /** 自定义 API 地址（sourceId === 'custom' 时生效） */
  customUrl?: string
  /** 自定义正文字段名 */
  customTextField?: string
  /** 自定义出处字段名 */
  customAuthorField?: string
}

interface HitokotoConfigResponse {
  success: boolean
  config?: HitokotoConfig
  message?: string
}

export const DEFAULT_HITOKOTO_CONFIG: HitokotoConfig = {
  sourceId: DEFAULT_HITOKOTO_SOURCE_ID,
}

export const HITOKOTO_CONFIG_UPDATED_EVENT = 'hitokoto-config-updated'

export function normalizeHitokotoConfig(
  config?: Partial<HitokotoConfig>,
): HitokotoConfig {
  return {
    sourceId:
      typeof config?.sourceId === 'string'
        ? config.sourceId
        : DEFAULT_HITOKOTO_SOURCE_ID,
    customUrl: config?.customUrl,
    customTextField: config?.customTextField,
    customAuthorField: config?.customAuthorField,
  }
}

/** 从后端读取一言配置 */
export async function fetchHitokotoConfig(): Promise<HitokotoConfig> {
  const response = await apiService.get<HitokotoConfigResponse>(
    '/config/hitokoto',
  )
  return normalizeHitokotoConfig(response.config)
}

/** 保存一言配置到后端，并清除本地一言缓存，使新设置立即生效 */
export async function updateHitokotoConfig(
  config: HitokotoConfig,
): Promise<HitokotoConfig> {
  const response = await apiService.put<HitokotoConfigResponse>(
    '/config/hitokoto',
    config,
  )
  if (!response.success) {
    throw new Error(response.message || 'Failed to save hitokoto config')
  }
  const saved = normalizeHitokotoConfig(response.config)
  // 切换源后旧缓存失效
  localStorage.removeItem('quote_cache')
  localStorage.removeItem('quote_cache_time')
  localStorage.removeItem('quote_cache_source')
  localStorage.removeItem('quote_data_cache')
  window.dispatchEvent(
    new CustomEvent(HITOKOTO_CONFIG_UPDATED_EVENT, { detail: saved }),
  )
  return saved
}

/** 比较两份一言配置是否等价（用于统一保存流程的脏检测） */
export function areHitokotoConfigsEqual(
  left: HitokotoConfig,
  right: HitokotoConfig,
): boolean {
  return (
    left.sourceId === right.sourceId &&
    (left.customUrl ?? '') === (right.customUrl ?? '') &&
    (left.customTextField ?? '') === (right.customTextField ?? '') &&
    (left.customAuthorField ?? '') === (right.customAuthorField ?? '')
  )
}

/** 根据配置解析出当前生效的一言源 */
export async function resolveHitokotoSource(
  config?: HitokotoConfig,
): Promise<HitokotoSource | null> {
  const resolved = config ?? (await fetchHitokotoConfig())
  return resolveHitokotoSourceFromConfig(resolved)
}

function resolveHitokotoSourceFromConfig(
  config: HitokotoConfig,
): HitokotoSource | null {
  if (config.sourceId === 'custom') {
    const url = config.customUrl?.trim()
    if (!url) return null
    return {
      id: 'custom',
      url,
      textField: config.customTextField?.trim() || 'hitokoto',
      authorField: config.customAuthorField?.trim() || 'from',
    }
  }
  return (
    BUILTIN_HITOKOTO_SOURCES[config.sourceId] ??
    BUILTIN_HITOKOTO_SOURCES[DEFAULT_HITOKOTO_SOURCE_ID]
  )
}

/**
 * 获取一言警句
 */
export async function getRandomQuote(
  locale?: string,
): Promise<QuoteData | null> {
  let source: HitokotoSource | null
  try {
    source = await resolveHitokotoSource()
  } catch (error) {
    console.warn('Failed to load hitokoto config:', error)
    return getLocalQuote(locale)
  }
  // 自定义源未填写地址时，直接回退本地句库
  if (!source) return getLocalQuote(locale)

  try {
    // 从 localStorage 读取缓存（缓存需匹配当前源地址）
    const cachedQuote = localStorage.getItem('quote_cache')
    const cacheTime = localStorage.getItem('quote_cache_time')
    const cacheSource = localStorage.getItem('quote_cache_source')

    if (cachedQuote && cacheTime && cacheSource === source.url) {
      const cacheAge = Date.now() - Number.parseInt(cacheTime)
      // 缓存 10 分钟
      if (cacheAge < 10 * 60 * 1000) {
        return JSON.parse(cachedQuote)
      }
    }

    // 使用后端代理访问一言 API（解决 CORS 问题）
    // 默认源无需传 url，自定义/其他语言源通过 url 参数转发
    const proxyUrl =
      source.id === DEFAULT_HITOKOTO_SOURCE_ID
        ? `${API_URL}/api/proxy/hitokoto`
        : `${API_URL}/api/proxy/hitokoto?url=${encodeURIComponent(source.url)}`

    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error('Hitokoto API failed')

    const data = await response.json()
    // 部分源（如日语 meigen）返回数组，取首项
    const payload = Array.isArray(data) ? data[0] : data

    const text = payload?.[source.textField]
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Hitokoto response missing text field')
    }
    const author = source.authorField
      ? payload?.[source.authorField]
      : undefined

    const quoteData: QuoteData = {
      text,
      author: typeof author === 'string' && author.trim() ? author : undefined,
    }

    // 缓存结果
    localStorage.setItem('quote_cache', JSON.stringify(quoteData))
    localStorage.setItem('quote_cache_time', Date.now().toString())
    localStorage.setItem('quote_cache_source', source.url)

    return quoteData
  } catch (error) {
    console.warn('Failed to fetch quote:', error)
    // 返回本地备用句子
    return getLocalQuote(locale)
  }
}

/**
 * 本地备用句子库
 */
function getLocalQuote(locale?: string): QuoteData {
  const quotesZhCN = [
    { text: '代码如诗，优雅至上', author: '程序员格言' },
    { text: '简洁是可靠的前提', author: 'Edsger Dijkstra' },
    { text: '过早优化是万恶之源', author: 'Donald Knuth' },
    {
      text: '任何可以被编写成 JavaScript 的程序，最终都会被编写成 JavaScript',
      author: 'Atwood 定律',
    },
    { text: '好的代码本身就是最好的文档', author: 'Steve McConnell' },
    { text: '先让它运行起来，再让它变得更好', author: 'Kent Beck' },
    { text: '代码是写给人看的，顺便让机器执行', author: 'Harold Abelson' },
    {
      text: '测试不能证明程序没有 bug，只能证明 bug 的存在',
      author: 'Edsger Dijkstra',
    },
  ]

  const quotesEnUS = [
    {
      text: "Code is like humor. When you have to explain it, it's bad.",
      author: 'Cory House',
    },
    { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
    { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
    { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
    { text: 'Software is eating the world.', author: 'Marc Andreessen' },
    {
      text: 'The best way to predict the future is to invent it.',
      author: 'Alan Kay',
    },
  ]

  const quotesJaJP = [
    { text: 'コードは詩のように、優雅であれ', author: 'プログラマーの格言' },
    { text: 'シンプルさは信頼性の前提条件である', author: 'Edsger Dijkstra' },
    { text: '早すぎる最適化は諸悪の根源', author: 'Donald Knuth' },
    {
      text: '動くようにしてから、正しくしてから、速くする',
      author: 'Kent Beck',
    },
    { text: '良いコードは最高のドキュメントである', author: 'Steve McConnell' },
    {
      text: '未来を予測する最良の方法は、それを発明することだ',
      author: 'Alan Kay',
    },
  ]

  let quotes: QuoteData[]
  switch (locale) {
    case 'en-US':
      quotes = quotesEnUS
      break
    case 'ja-JP':
      quotes = quotesJaJP
      break
    default:
      quotes = quotesZhCN
  }

  return quotes[Math.floor(Math.random() * quotes.length)]
}

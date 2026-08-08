/**
 * 一言(每日格言)工具 —— 静态官网版
 *
 * 直接请求一言公共 API(v1.hitokoto.cn 支持 CORS),不再走后端代理;
 * 失败回退本地句库。10 分钟 localStorage 缓存,避免频繁请求。
 */

export interface QuoteData {
  text: string
  author?: string
}

/** 一言源定义 */
export interface HitokotoSource {
  /** 源 ID */
  id: string
  /** API 地址 */
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

/**
 * 一言配置更新事件(静态站点配置不可变更,事件保留仅为接口兼容)
 */
export const HITOKOTO_CONFIG_UPDATED_EVENT = 'hitokoto-config-updated'

/**
 * 获取一言警句
 */
export async function getRandomQuote(
  locale?: string,
): Promise<QuoteData | null> {
  const source = BUILTIN_HITOKOTO_SOURCES[DEFAULT_HITOKOTO_SOURCE_ID]

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

    const response = await fetch(source.url, {
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

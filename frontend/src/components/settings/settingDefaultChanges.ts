/**
 * 产品默认值变更提示
 *
 * - SETTING_PRODUCT_DEFAULTS：当前产品默认（与 defaultFieldValues / 后端 Config 默认对齐）
 * - localStorage 记录「用户已知的默认」与已关闭的 transition id
 * - 当 known ≠ product 且未关闭时，标题旁展示可关闭标签
 *
 * 首次安装本功能时，用 LEGACY_SEED_DEFAULTS 初始化 known，
 * 使本轮已发生的默认变更也能弹出一次提示。
 */

const STORAGE_KEY = 'myriad_setting_default_notices_v1'

/** 当前产品默认值（字段 key → 默认字符串） */
export const SETTING_PRODUCT_DEFAULTS: Readonly<Record<string, string>> = {
  // Gemini
  model: 'gemini-3.6-flash',
  gemini_model: 'gemini-3.6-flash',
  lite_gemini_model: 'gemini-3.5-flash-lite',
  pro_gemini_model: 'gemini-3.1-pro-preview',
  // OpenRouter / OpenAI-compatible text（后端 Config 默认）
  openai_model: 'minimax/minimax-m3',
  lite_openai_model: 'openai/gpt-oss-20b:free',
  pro_openai_model: 'anthropic/claude-opus-5',
  // Image
  ai_image_model: 'openai/gpt-image-2',
  // OpenAI 官方三档（切换到 openai 时的预设；用 @openai 后缀区分）
  'openai_model@openai': 'gpt-5.6-terra',
  'lite_openai_model@openai': 'gpt-5.6-luna',
  'pro_openai_model@openai': 'gpt-5.6-sol',
}

/**
 * 本功能上线前的默认快照：仅用于首次写入 known。
 * 与 SETTING_PRODUCT_DEFAULTS 不同的 key 会在首次打开设置时出现「默认已更新」。
 */
const LEGACY_SEED_DEFAULTS: Readonly<Record<string, string>> = {
  model: 'gemini-3-flash-preview',
  gemini_model: 'gemini-3.5-flash',
  lite_gemini_model: 'gemini-3.5-flash',
  pro_gemini_model: 'gemini-3.1-pro-preview',
  openai_model: 'minimax/minimax-m3',
  lite_openai_model: 'openai/gpt-oss-20b:free',
  pro_openai_model: 'anthropic/claude-opus-4.8',
  ai_image_model: 'openai/gpt-image-2',
  'openai_model@openai': 'gpt-5.5',
  'lite_openai_model@openai': 'gpt-5.5',
  'pro_openai_model@openai': 'gpt-5.5',
}

interface StoredState {
  /** 用户已确认/已知的默认值 */
  known: Record<string, string>
  /** 已关闭的变更 id：`${key}:${from}→${to}` */
  dismissed: string[]
}

const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeSettingDefaultChanges(
  listener: () => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function readState(): StoredState {
  if (typeof localStorage === 'undefined') {
    return { known: {}, dismissed: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return seedInitialState()
    }
    const parsed = JSON.parse(raw) as Partial<StoredState>
    return {
      known:
        parsed.known && typeof parsed.known === 'object' ? parsed.known : {},
      dismissed: Array.isArray(parsed.dismissed)
        ? parsed.dismissed.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    return seedInitialState()
  }
}

function writeState(state: StoredState, options?: { silent?: boolean }): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
  if (!options?.silent) notify()
}

/** 首次：用 legacy 快照填充 known，以便本轮默认变更可提示 */
function seedInitialState(): StoredState {
  const known: Record<string, string> = { ...LEGACY_SEED_DEFAULTS }
  // 产品里有、legacy 没有的 key，直接记当前默认，避免无意义提示
  for (const [key, value] of Object.entries(SETTING_PRODUCT_DEFAULTS)) {
    if (!(key in known)) known[key] = value
  }
  const state: StoredState = { known, dismissed: [] }
  // 静默写入：避免在首屏 render 读 storage 时触发订阅重渲
  writeState(state, { silent: true })
  return state
}

function transitionId(key: string, from: string, to: string): string {
  return `${key}:${from}→${to}`
}

export interface SettingDefaultChangeNotice {
  fieldKey: string
  from: string
  to: string
  transitionId: string
}

/**
 * 若该字段产品默认相对用户 known 已变且未关闭，返回提示信息。
 */
export function getSettingDefaultChangeNotice(
  fieldKey: string | undefined | null,
): SettingDefaultChangeNotice | null {
  if (!fieldKey) return null
  const product = SETTING_PRODUCT_DEFAULTS[fieldKey]
  if (product == null) return null

  const state = readState()
  const known = state.known[fieldKey]
  // known 缺失：记为当前默认，不弹（新字段）
  if (known == null) {
    const next = {
      ...state,
      known: { ...state.known, [fieldKey]: product },
    }
    writeState(next, { silent: true })
    return null
  }
  if (known === product) return null

  const id = transitionId(fieldKey, known, product)
  if (state.dismissed.includes(id)) return null

  return {
    fieldKey,
    from: known,
    to: product,
    transitionId: id,
  }
}

/** 关闭提示，并将 known 更新为当前产品默认 */
export function dismissSettingDefaultChange(
  fieldKey: string | undefined | null,
): void {
  if (!fieldKey) return
  const product = SETTING_PRODUCT_DEFAULTS[fieldKey]
  if (product == null) return

  const state = readState()
  const known = state.known[fieldKey] ?? product
  const id = transitionId(fieldKey, known, product)
  const dismissed = state.dismissed.includes(id)
    ? state.dismissed
    : [...state.dismissed, id]

  writeState({
    known: { ...state.known, [fieldKey]: product },
    dismissed,
  })
}

/**
 * 开发/测试：清除持久化状态（恢复本轮提示）。
 * 未导出到 UI；需要时在控制台手动调用。
 */
export function resetSettingDefaultChangeNoticesForTests(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  notify()
}

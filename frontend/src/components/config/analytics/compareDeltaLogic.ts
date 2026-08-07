/**
 * Analytics 环比：日 / 周 / 月 / 较上期
 *
 * Backend shape:
 *   { current, previous, pct: number | null }
 * `pct === null` → previous was 0 while current > 0 (no baseline).
 */

export type CompareKind = 'day' | 'week' | 'month' | 'period'

export interface MetricDelta {
  current?: number
  previous?: number
  /** Percent change; null = undefined (new / no baseline) */
  pct?: number | null
}

export interface CompareLabels {
  day: string
  week: string
  month: string
  period: string
  /** When previous is 0 and current > 0 */
  new: string
  /** Accessible title with previous absolute value */
  vsPrevious: string
}

export function compareKindLabel(
  kind: string | undefined,
  labels: CompareLabels,
): string {
  switch (kind) {
    case 'day':
      return labels.day
    case 'week':
      return labels.week
    case 'month':
      return labels.month
    default:
      return labels.period
  }
}

/** Tone for styling: up / down / flat / new / none */
export type CompareTone = 'up' | 'down' | 'flat' | 'new' | 'none'

/**
 * Regional color convention for increase / decrease.
 * - `green-up`: Western default (green rise, red fall)
 * - `red-up`: East Asian equity boards 红涨绿跌 (zh / ja / ko)
 */
export type CompareColorPalette = 'green-up' | 'red-up'

export function compareTone(delta: MetricDelta | null | undefined): CompareTone {
  if (!delta) return 'none'
  const pct = delta.pct
  if (pct == null) {
    const cur = Number(delta.current ?? 0)
    return cur > 0 ? 'new' : 'flat'
  }
  if (!Number.isFinite(pct) || pct === 0) return 'flat'
  return pct > 0 ? 'up' : 'down'
}

/** Map UI locale → rise/fall color palette (not hard-coded green=up). */
export function compareColorPalette(locale: string): CompareColorPalette {
  const lang = (locale || 'en').toLowerCase().split(/[-_]/)[0] ?? 'en'
  // Mainland / Taiwan / HK share 红涨绿跌 with JP & KR boards.
  if (lang === 'zh' || lang === 'ja' || lang === 'ko') return 'red-up'
  return 'green-up'
}

/**
 * Format signed percent for display, e.g. `+12.3%`, `−5%`, `0%`.
 * Uses a proper minus sign for negatives.
 */
export function formatComparePct(
  pct: number | null | undefined,
  locale: string,
): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  const abs = Math.abs(pct)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 1
  let body: string
  try {
    body = new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(abs)
  } catch {
    body = abs.toFixed(digits)
  }
  if (pct > 0) return `+${body}%`
  if (pct < 0) return `−${body}%`
  return `${body}%`
}

export function formatCompareValue(
  delta: MetricDelta | null | undefined,
  locale: string,
  labels: Pick<CompareLabels, 'new'>,
): string {
  if (!delta) return '—'
  if (delta.pct == null) {
    const cur = Number(delta.current ?? 0)
    return cur > 0 ? labels.new : '0%'
  }
  return formatComparePct(delta.pct, locale)
}

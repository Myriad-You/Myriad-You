/**
 * Pure mappers: AI usage API rows → TrendChart / RankList shapes.
 */

import type { RankRow } from './RankList'
import type { TrendPoint } from './TrendChart'

export function aiDailyToTrendPoints(
  daily: Array<{ day: string; calls: number; tokens: number }>,
): TrendPoint[] {
  return daily.map((d) => ({
    day: d.day,
    views: d.calls,
    visitors: d.tokens,
  }))
}

export function aiUserDisplayName(
  row: {
    subject_id: number
    username?: string | null
    display_name?: string | null
  },
  anonymousLabel: string,
): string {
  if (row.subject_id <= 0) return anonymousLabel
  const name =
    (row.display_name && row.display_name.trim()) ||
    (row.username && row.username.trim()) ||
    ''
  if (name) return name
  return `#${row.subject_id}`
}

export function aiUsersToRankRows(
  users: Array<{
    subject_id: number
    username?: string | null
    display_name?: string | null
    calls: number
    tokens: number
  }>,
  opts: { anonymousLabel: string; callsLabel: (n: number) => string },
): RankRow[] {
  return users.map((u) => ({
    key: String(u.subject_id),
    name: aiUserDisplayName(u, opts.anonymousLabel),
    meta:
      u.subject_id > 0
        ? u.username && u.display_name && u.username !== u.display_name
          ? `@${u.username}`
          : `id ${u.subject_id}`
        : undefined,
    value: u.tokens,
    secondary: opts.callsLabel(u.calls),
  }))
}

export function aiModelsToRankRows(
  models: Array<{
    model: string
    provider?: string
    calls: number
    tokens: number
  }>,
  opts: { callsLabel: (n: number) => string },
): RankRow[] {
  return models.map((m) => ({
    key: m.model,
    name: m.model || '—',
    meta: m.provider || undefined,
    value: m.tokens,
    secondary: opts.callsLabel(m.calls),
  }))
}

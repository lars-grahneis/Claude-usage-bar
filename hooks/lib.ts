import type {
  SessionContextBreakdown,
  SessionMeasureInput,
  SessionRateLimit,
} from 'claude-code'

import type { Breakdown, Level, Limit, Snapshot, Warned } from '../types'

/** Up to a third of the window is green, up to two thirds yellow, above red. */
export const levelOf = (percent: number): Level =>
  percent * 3 < 100 ? 'low' : percent * 3 <= 200 ? 'medium' : 'high'

/** The warning fires once the fill passes two thirds. */
export const isHigh = (percent: number | undefined): boolean =>
  percent !== undefined && levelOf(percent) === 'high'

export const COLOR: Record<Level, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

export const bar = (percent: number, width: number): string => {
  const cells = Math.max(1, width)
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)

  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

export const formatTokens = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`
    : tokens >= 1000
      ? `${Math.round(tokens / 1000)}k`
      : `${tokens}`

export const formatPercent = (percent: number): string => `${Math.round(percent)}%`

/** "2h 05m", "14m", "now", from milliseconds left. */
export const formatDuration = (ms: number): string => {
  const minutes = Math.max(0, Math.round(ms / 60_000))

  if (minutes === 0) {
    return 'now'
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return hours === 0 ? `${rest}m` : `${hours}h ${String(rest).padStart(2, '0')}m`
}

export const resetsIn = (limit: Limit, now: number): string | undefined => {
  if (limit.resetsAt === undefined) {
    return undefined
  }

  const at = Date.parse(limit.resetsAt)

  return Number.isNaN(at) ? undefined : formatDuration(at - now)
}

const limitOf = (limits: readonly SessionRateLimit[], kind: string): Limit | undefined => {
  const found = limits.find(one => one.kind === kind)

  return found && { percent: found.percentUsed, resetsAt: found.resetsAt }
}

export const snapshotOf = (e: Pick<SessionMeasureInput, 'context' | 'rateLimits'>): Snapshot => ({
  contextPercent: e.context.percent,
  contextTokens: e.context.tokens,
  contextWindow: e.context.window,
  fiveHour: limitOf(e.rateLimits, 'five_hour'),
  sevenDay: limitOf(e.rateLimits, 'seven_day'),
})

/**
 * Which warnings to raise now, and the flags to keep: a warning fires on the
 * way past two thirds and arms again once the value is back below (after a
 * /compact, /clear or a reset of the window).
 */
export const crossings = (
  snapshot: Snapshot,
  warned: Warned,
): { toWarn: { context: boolean; fiveHour: boolean }; next: Warned } => {
  const contextHigh = isHigh(snapshot.contextPercent)
  const fiveHourHigh = isHigh(snapshot.fiveHour?.percent)

  return {
    toWarn: { context: contextHigh && !warned.context, fiveHour: fiveHourHigh && !warned.fiveHour },
    next: { context: contextHigh, fiveHour: fiveHourHigh },
  }
}

const groupBy = (items: readonly { key: string; tokens: number }[]) => {
  const sums = new Map<string, number>()

  for (const item of items) {
    sums.set(item.key, (sums.get(item.key) ?? 0) + item.tokens)
  }

  return [...sums]
    .map(([name, tokens]) => ({ name, tokens }))
    .sort((a, b) => b.tokens - a.tokens)
}

export const breakdownOf = (
  raw: SessionContextBreakdown,
  detail: 'summary' | 'full',
  measuredAt: number,
): Breakdown => ({
  detail,
  measuredAt,
  totalTokens: raw.totalTokens,
  maxTokens: raw.rawMaxTokens,
  percent: raw.percentage,
  rows: raw.categories.map(row => ({
    name: row.name,
    tokens: row.tokens,
    percent: raw.rawMaxTokens > 0 ? (row.tokens / raw.rawMaxTokens) * 100 : 0,
    kind: row.kind,
  })),
  mcpServers: groupBy(
    raw.mcpTools.filter(tool => tool.isLoaded).map(tool => ({ key: tool.serverName, tokens: tool.tokens })),
  ),
  memoryFiles: groupBy(raw.memoryFiles.map(file => ({ key: file.path, tokens: file.tokens }))),
})

export const DOT: Record<Level, string> = { low: '🟢', medium: '🟡', high: '🔴' }

/** Surfaces that draw the band above the prompt; the others get the status line. */
export const BAND_SURFACES: readonly string[] = ['terminal', 'desktop']

/** One plain line for surfaces without the band: "🟢 Context 20% · 🟡 5h limit 50% (resets in 2h 05m)". */
export const statusLine = (snapshot: Snapshot, now: number): string | undefined => {
  const parts: string[] = []

  if (snapshot.contextPercent !== undefined) {
    const high = isHigh(snapshot.contextPercent) ? ' – consider /compact or /clear' : ''
    parts.push(`${DOT[levelOf(snapshot.contextPercent)]} Context ${formatPercent(snapshot.contextPercent)}${high}`)
  }

  if (snapshot.fiveHour) {
    const reset = resetsIn(snapshot.fiveHour, now)
    parts.push(
      `${DOT[levelOf(snapshot.fiveHour.percent)]} 5h limit ${formatPercent(snapshot.fiveHour.percent)}` +
        (reset ? ` (resets in ${reset})` : ''),
    )
  }

  return parts.length > 0 ? parts.join('  ·  ') : undefined
}

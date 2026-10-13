export type Level = 'low' | 'medium' | 'high'

export type Limit = {
  /** 0 to 100 */
  percent: number
  /** ISO 8601 timestamp of the window's reset, when reported */
  resetsAt?: string
}

export type Snapshot = {
  /** 0 to 100; absent before the first response of the live window */
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  fiveHour?: Limit
  sevenDay?: Limit
}

export type BreakdownRow = {
  name: string
  tokens: number
  /** share of the measured window, 0 to 100 */
  percent: number
  kind: 'used' | 'free' | 'buffer' | 'deferred'
}

export type BreakdownGroup = { name: string; tokens: number }

export type Breakdown = {
  detail: 'summary' | 'full'
  measuredAt: number
  totalTokens: number
  maxTokens: number
  percent: number
  rows: BreakdownRow[]
  mcpServers: BreakdownGroup[]
  memoryFiles: BreakdownGroup[]
}

export type Warned = { context: boolean; fiveHour: boolean }

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': {
      snapshot: Snapshot | null
      breakdown: Breakdown | null
      isCounting: boolean
      warned: Warned
    }
  }
}

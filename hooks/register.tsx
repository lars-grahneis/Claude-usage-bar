import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Breakdown, Limit, Snapshot, Warned } from '../types'
import {
  COLOR,
  bar,
  breakdownOf,
  crossings,
  formatPercent,
  formatTokens,
  isHigh,
  levelOf,
  resetsIn,
  snapshotOf,
} from './lib'

const PANE = 'usage-bar'
const COMMAND = 'usage-bar'

const snapshot = atom({ plugin: 'usage-bar', key: 'snapshot' } as const, null as Snapshot | null)
const breakdown = atom({ plugin: 'usage-bar', key: 'breakdown' } as const, null as Breakdown | null)
const isCounting = atom({ plugin: 'usage-bar', key: 'isCounting' } as const, false)
const warned = atom({ plugin: 'usage-bar', key: 'warned' } as const, { context: false, fiveHour: false } as Warned)

const FULL_NOTE =
  'Exact count sends one token-counting request per tool and memory file, as /context does. ' +
  'These are extra API requests and may count toward your usage limits.'

const measureBreakdown = async ($: EngineInterface, detail: 'summary' | 'full') => {
  await update($, isCounting, () => true)

  try {
    const usage = await $.session.usage({ breakdown: detail })
    const raw = usage.context.breakdown

    if (raw) {
      const now = await $.clock.now()
      await update($, breakdown, () => breakdownOf(raw, detail, now))
    }
  } catch {
    $.ui.toast('Could not measure the context breakdown.')
  } finally {
    await update($, isCounting, () => false)
  }
}

const record = async ($: EngineInterface, next: Snapshot) => {
  await update($, snapshot, () => next)

  const before = await read($, warned)
  const { toWarn, next: flags } = crossings(next, before)
  await update($, warned, () => flags)

  if (toWarn.context && next.contextPercent !== undefined) {
    $.ui.toast(
      `Context ${formatPercent(next.contextPercent)} full. Consider /compact or /clear to keep the context lean.`,
    )
  }

  if (toWarn.fiveHour && next.fiveHour) {
    const reset = resetsIn(next.fiveHour, await $.clock.now())
    $.ui.toast(
      `5-hour usage limit at ${formatPercent(next.fiveHour.percent)}` +
        (reset ? `, resets in ${reset}.` : '.'),
    )
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Show what fills the context window, and the usage limits',
    })

    try {
      const usage = await $.session.usage()
      await update($, snapshot, () => snapshotOf(usage))
    } catch {
      // The first session.measure fills the bar instead.
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await record($, snapshotOf(e))

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: 'Context usage' }).catch(() => undefined)
    void measureBreakdown($, 'summary')

    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, snapshot)

    if (e.props.hasSurvey || current === null || e.props.view.agentId !== undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const width = Math.max(8, Math.min(24, e.props.bodyColumns - 44))
    const contextHigh = isHigh(current.contextPercent)

    const meter = (label: string, percent: number, detail: string) => (
      <Text>
        {label}
        <Text color={COLOR[levelOf(percent)]}>{bar(percent, width)}</Text>
        {' '}
        <Text bold color={COLOR[levelOf(percent)]}>
          {formatPercent(percent).padStart(4)}
        </Text>
        <Text dimColor>{detail}</Text>
      </Text>
    )

    const limitDetail = (limit: Limit) => {
      const reset = resetsIn(limit, now)
      const week = current.sevenDay ? `  ·  7d ${formatPercent(current.sevenDay.percent)}` : ''

      return (reset ? `  ·  resets in ${reset}` : '') + week
    }

    return (
      <Box flexDirection="column">
        {current.contextPercent === undefined ? (
          <Text dimColor>Context  waiting for the first response · window {formatTokens(current.contextWindow)}</Text>
        ) : (
          meter(
            'Context  ',
            current.contextPercent,
            `  ·  ${formatTokens(current.contextTokens ?? 0)} / ${formatTokens(current.contextWindow)}`,
          )
        )}
        {current.fiveHour && meter('5h limit ', current.fiveHour.percent, limitDetail(current.fiveHour))}
        {contextHigh && !e.props.isWorking && (
          <Box flexDirection="row">
            <Text color="error">Over 2/3 of the context is used. Start fresh? </Text>
            <Button key="compact" label="Compact" hotkey="c" onPress={() => void $.session.compact().catch(() => $.ui.toast('Compaction did not run.'))} />
            <Text> </Text>
            <Button
              key="clear"
              label="Clear"
              hotkey="x"
              onPress={async () => {
                await $.prompt.fill({ text: '/clear' })
                $.ui.toast('Press Enter to clear the conversation.')
              }}
            />
            <Text> </Text>
            <Button
              key="details"
              label="Details"
              hotkey="d"
              onPress={async () => {
                await $.ui.open({ id: PANE, title: 'Context usage' })
                await measureBreakdown($, 'summary')
              }}
            />
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await read($, breakdown)
    const counting = await read($, isCounting)
    const nameWidth = 22
    const width = Math.max(6, Math.min(20, e.props.bodyColumns - nameWidth - 18))

    const actions = (
      <Box flexDirection="row">
        <Button key="refresh" label="Refresh" hotkey="r" onPress={() => measureBreakdown($, 'summary')} />
        <Text> </Text>
        <Button key="full" label="Exact count (uses API)" hotkey="f" onPress={() => measureBreakdown($, 'full')} />
      </Box>
    )

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{counting ? 'Measuring…' : 'No breakdown yet.'}</Text>
          {actions}
        </Box>
      )
    }

    const row = (name: string, tokens: number, percent: number, color?: string) => (
      <Text>
        {name.slice(0, nameWidth).padEnd(nameWidth)}
        <Text color={color}>{bar(percent, width)}</Text>
        {` ${formatTokens(tokens).padStart(6)}  ${formatPercent(percent).padStart(4)}`}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold color={COLOR[levelOf(current.percent)]}>
            {formatPercent(current.percent)}
          </Text>
          {` of ${formatTokens(current.maxTokens)} used (${formatTokens(current.totalTokens)})`}
          <Text dimColor>
            {current.detail === 'summary' ? '  ·  estimate' : '  ·  exact count'}
            {counting ? '  ·  measuring…' : ''}
          </Text>
        </Text>
        <Text> </Text>
        {current.rows
          .filter(one => one.kind !== 'deferred')
          .map(one => row(one.name, one.tokens, one.percent, one.kind === 'used' ? undefined : 'inactive'))}
        {current.mcpServers.length > 0 && <Text bold>MCP servers</Text>}
        {current.mcpServers.map(one =>
          row(`  ${one.name}`, one.tokens, (one.tokens / current.maxTokens) * 100, 'inactive'),
        )}
        {current.memoryFiles.length > 0 && <Text bold>Memory files</Text>}
        {current.memoryFiles.map(one =>
          row(`  ${one.name.split('/').pop() ?? one.name}`, one.tokens, (one.tokens / current.maxTokens) * 100, 'inactive'),
        )}
        <Text> </Text>
        {actions}
        <Text dimColor>{FULL_NOTE}</Text>
      </Box>
    )
  })
}

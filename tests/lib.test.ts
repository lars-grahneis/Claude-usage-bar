import { expect, test } from 'claude-code/testing'

import { bar, crossings, formatDuration, formatTokens, levelOf } from '../hooks/lib'

test('thirds pick the color level', () => {
  expect(levelOf(0)).toBe('low')
  expect(levelOf(33)).toBe('low')
  expect(levelOf(34)).toBe('medium')
  expect(levelOf(66)).toBe('medium')
  expect(levelOf(67)).toBe('high')
  expect(levelOf(100)).toBe('high')
})

test('bar fills by percent and clamps', () => {
  expect(bar(50, 10)).toBe('█████░░░░░')
  expect(bar(0, 4)).toBe('░░░░')
  expect(bar(150, 4)).toBe('████')
})

test('formats tokens and durations', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(128_400)).toBe('128k')
  expect(formatTokens(1_000_000)).toBe('1M')
  expect(formatDuration(125 * 60_000)).toBe('2h 05m')
  expect(formatDuration(14 * 60_000)).toBe('14m')
  expect(formatDuration(-5)).toBe('now')
})

test('a warning fires once past two thirds and re-arms below', () => {
  const fresh = { context: false, fiveHour: false }
  const high = crossings({ contextPercent: 70, contextWindow: 1, fiveHour: { percent: 20 } }, fresh)
  expect(high.toWarn).toEqual({ context: true, fiveHour: false })

  const again = crossings({ contextPercent: 75, contextWindow: 1, fiveHour: { percent: 20 } }, high.next)
  expect(again.toWarn.context).toBe(false)

  const low = crossings({ contextPercent: 10, contextWindow: 1 }, again.next)
  expect(low.next.context).toBe(false)
  expect(crossings({ contextPercent: 68, contextWindow: 1 }, low.next).toWarn.context).toBe(true)
})

import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { statusLine } from '../hooks/lib'

const NOW = Date.parse('2026-10-13T10:00:00Z')

const measure = {
  context: { tokens: 140_000, window: 200_000, percent: 70 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 40, resetsAt: '2026-10-13T12:05:00Z' }],
  changed: ['context', 'rateLimits'] as ('context' | 'rateLimits')[],
}

const engine = (on: On, surfaces: string[], lines: (string | undefined)[]) => {
  mock.clock(on, { now: NOW })
  on('session.measure', async ($, e) => ({ changed: e.changed }))
  on('session.surfaces', async () => ({ value: surfaces }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('ui.status', async ($, e) => {
    lines.push(e.text)
    return { value: undefined } as never
  })
}

test('status line text', () => {
  expect(statusLine({ contextPercent: 20, contextWindow: 1, fiveHour: { percent: 50 } }, NOW)).toBe(
    '🟢 Context 20%  ·  🟡 5h limit 50%',
  )
  expect(statusLine({ contextWindow: 1 }, NOW)).toBeUndefined()
})

test('VS Code gets the figures as a status line', async ($, on) => {
  const lines: (string | undefined)[] = []
  engine(on, ['vscode'], lines)
  await $.session.measure(measure)

  expect(lines.at(-1)).toBe(
    '🔴 Context 70% – consider /compact or /clear  ·  🟡 5h limit 40% (resets in 2h 05m)',
  )
})

test('terminal and desktop keep the band alone', async ($, on) => {
  const lines: (string | undefined)[] = []
  engine(on, ['terminal', 'desktop'], lines)
  await $.session.measure(measure)

  expect(lines.at(-1)).toBeUndefined()
})

import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-bar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-10-13T10:00:00Z')

const measure = (contextPercent: number, fiveHour: number) => ({
  context: { tokens: contextPercent * 2000, window: 200_000, percent: contextPercent },
  rateLimits: [
    { kind: 'five_hour', percentUsed: fiveHour, resetsAt: '2026-10-13T12:05:00Z' },
    { kind: 'seven_day', percentUsed: 22 },
  ],
  changed: ['context', 'rateLimits'] as const,
})

const engine = (on: On) => {
  mock.clock(on, { now: NOW })
  on('session.measure', async ($, e) => ({ changed: e.changed }))
}

test('the band shows context and the 5-hour limit in color', async ($, on) => {
  engine(on)
  await $.session.measure({ ...measure(20, 50), changed: ['context', 'rateLimits'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Context.*20%.*40k \/ 200k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5h limit.*50%.*resets in 2h 05m.*7d 22%/ })).toBeDefined()
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    await ui.unmount()
  }
})

test('past two thirds: one toast each, and compact/clear offered', async ($, on) => {
  engine(on)
  const toasts: string[] = []
  on('ui.toast', async ($, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  const filled: string[] = []
  on('prompt.fill', async ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  await $.session.measure({ ...measure(70, 70), changed: ['context', 'rateLimits'] })
  await $.session.measure({ ...measure(72, 71), changed: ['context', 'rateLimits'] })

  expect(toasts.length).toBe(2)
  expect(toasts[0]).toMatch(/Context 70% full/)
  expect(toasts[1]).toMatch(/5-hour usage limit at 70%, resets in 2h 05m/)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'compact' })).toBeDefined()
  await ui.press({ key: 'clear' })
  expect(filled).toEqual(['/clear'])
})

import { expect, mock, test } from 'claude-code/testing'

const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 4000, color: 'promptBorder', isDeferred: false, kind: 'used' },
    { name: 'MCP tools', tokens: 12000, color: 'permission', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 84000, color: 'claude', isDeferred: false, kind: 'used' },
    { name: 'Free space', tokens: 67000, color: 'inactive', isDeferred: false, kind: 'free' },
    { name: 'Autocompact buffer', tokens: 33000, color: 'inactive', isDeferred: false, kind: 'buffer' },
  ],
  totalTokens: 100_000,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  percentage: 50,
  mcpTools: [
    { name: 'search', serverName: 'github', tokens: 7000, isLoaded: true },
    { name: 'read', serverName: 'github', tokens: 3000, isLoaded: true },
    { name: 'mail', serverName: 'gmail', tokens: 2000, isLoaded: true },
  ],
  memoryFiles: [{ path: '/home/me/project/CLAUDE.md', type: 'Project', tokens: 1500 }],
}

test('/usage-bar opens a pane with the breakdown and an API-cost note', async ($, on) => {
  mock.clock(on, { now: 0 })
  const details: (string | undefined)[] = []
  on('session.usage', async ($, e) => {
    details.push(e.breakdown)
    return {
      value: {
        startedAt: 0,
        context: { window: 200_000, tokens: 100_000, percent: 50, breakdown: BREAKDOWN },
        rateLimits: [],
      },
    } as never
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)

  await $.command.run({ command: 'usage-bar', args: '' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-bar',
      surface,
      component: 'Pane',
      requestId: 'usage-bar',
      props: { title: 'Context usage', isFocused: false, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} } as never,
    })
    expect(await ui.find({ type: 'Text', text: /50% of 200k used/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Messages.*84k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /github.*10k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /CLAUDE\.md/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /may count toward your usage limits/ })).toBeDefined()
    await ui.press({ key: 'full' })
    await ui.unmount()
  }

  expect(details).toEqual(['summary', 'full', 'full'])
})

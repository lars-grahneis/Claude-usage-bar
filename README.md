# Claude Usage Bar

A small mod for [Claude Code](https://claude.com/claude-code) that shows how full the context window is and how much of the 5-hour usage limit is used, as a colored bar above the prompt.

```
Context  ████████████░░░░░░░░░░░░  48%  ·  96k / 200k
5h limit ██████████████████░░░░░░  74%  ·  resets in 1h 12m  ·  7d 22%
```

| Fill | Color |
| --- | --- |
| up to 1/3 | green |
| 1/3 to 2/3 | yellow |
| above 2/3 | red |

## What it does

- **Bar above the prompt**: context window fill (tokens used / window size) and the 5-hour usage limit with time to reset. The 7-day limit is shown as a small figure beside it.
- **Context above 2/3**: a one-time toast, and a row with `[ Compact ]` (runs `/compact`), `[ Clear ]` (puts `/clear` in the prompt box, Enter confirms) and `[ Details ]`. Nothing runs on its own.
- **5-hour limit above 2/3**: a one-time toast with the time to reset.
- **VS Code and the Claude mobile app**: these do not draw the band above the prompt, so the same figures appear as a status line with colored dots (🟢 🟡 🔴), e.g. `🔴 Context 70% – consider /compact or /clear  ·  🟡 5h limit 40% (resets in 2h 05m)`.
- **`/usage-bar`**: opens a pane with what fills the context, in the categories `/context` uses (system prompt, tools, MCP tools, memory files, messages, free space, autocompact buffer), plus tokens per MCP server and per memory file.
  - Default is an **estimate** (`summary`), computed locally, no extra requests.
  - **`[ Exact count (uses API) ]`** counts each category with the token-counting API, as `/context` does. This sends one extra request per tool and memory file, which may count toward your usage limits.

Warnings re-arm once the value drops below 2/3 again (after a compaction, `/clear` or a reset of the limit window).

## Requirements and limits

- Claude Code with mod (function hook) support. Developed against Claude Code 2.1.296; this API is marked early access and may change between releases.
- The usage limits are only reported on a Claude subscription (Pro/Max). With an API key the bar shows the context window only.
- The limits appear after the first response of a session.
- Images are not a separate category; they count under *Messages*, as in `/context`.
- Claude Code only. It does not touch claude.ai or the Claude desktop chat.
- The mod loads where Claude Code reads your user settings. VS Code connected to WSL runs Claude Code inside WSL, so install it there as well.

## Tested on

Tested with Claude Code 2.1.296 on Windows 11 and WSL2 (Ubuntu), October 2026.

| Where | Bar / status line | `/usage-bar` |
| --- | --- | --- |
| Windows Terminal (PowerShell) | bar above the prompt | yes |
| WSL terminal | bar above the prompt | yes |
| Claude Desktop app, local Code session | bar above the prompt | yes |
| VS Code, Claude panel (Windows and WSL) | status line | yes |
| VS Code, integrated terminal | not shown | yes |
| Cloud sessions (claude.ai/code, app "cloud") | not loaded: they run on a server without your plugins | no |

## Install

In a Claude Code terminal session:

```
/plugin install usage-bar --marketplace lars-grahneis/Claude-usage-bar
```

Answer `y` to add the marketplace, then choose the scope (user scope loads it in every session). Restart Claude Code afterwards.

Or from a shell (PowerShell, bash), outside Claude Code:

```
claude plugin marketplace add lars-grahneis/Claude-usage-bar
claude plugin install usage-bar@claude-usage-bar
```

Install it once per environment: Windows and WSL keep separate settings. The Claude Desktop app's local sessions use the Windows installation.

## Update

```
claude plugin marketplace update claude-usage-bar
claude plugin update usage-bar@claude-usage-bar
```

Then restart Claude Code (in VS Code: *Developer: Reload Window*). If that does not pick up the new version, uninstall and install again:

```
claude plugin uninstall usage-bar@claude-usage-bar
claude plugin install usage-bar@claude-usage-bar
```

## Development

```
claude --plugin-dir .            # run Claude Code with the mod from this folder
claude plugin validate .         # check manifest and hooks module
claude plugin test .             # run tests/*.test.ts
tsc -p .                         # type-check (types are written to .claude-plugin/types/ once the mod has loaded)
```

## Credits

Lars Grahneis, Assistenzarzt Pathologie, Universitätsklinikum des Saarlandes (UKS), Homburg

License: MIT

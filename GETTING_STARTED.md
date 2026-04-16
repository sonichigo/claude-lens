# Getting started with TokenLens

## Run from source

```bash
git clone <this-repo>
cd tokenlens
pnpm install
node packages/cli/bin/tokenlens.js
```

That's it. TokenLens will:
1. Discover `~/.claude/projects/` and backfill all existing sessions into `~/.tokenlens/store.db`
2. Start watching for new events
3. Launch the terminal UI
4. Start the web server at `http://localhost:7843` in the background

## Subcommands

```bash
node packages/cli/bin/tokenlens.js                # full experience
node packages/cli/bin/tokenlens.js web            # just the web dashboard (auto-opens browser)
node packages/cli/bin/tokenlens.js today          # print today's usage and exit
node packages/cli/bin/tokenlens.js scan           # rescan logs
node packages/cli/bin/tokenlens.js --no-web       # TUI only
node packages/cli/bin/tokenlens.js --no-tui       # daemon only
node packages/cli/bin/tokenlens.js --port 8080    # custom web port
```

## Requirements

- Node.js 20+
- At least one AI coding tool installed:
  - **Claude Code**: `~/.claude/projects/` directory (created after first use)
  - **Codex CLI**: `~/.codex/sessions/` directory (created after first use)
- On first install, `better-sqlite3` compiles a native binding. If this fails, install build tools:
  - macOS: `xcode-select --install`
  - Linux: `apt install build-essential python3`
  - Windows: `npm install -g windows-build-tools` (or use WSL)

TokenLens automatically detects which tools you have installed and monitors all of them. No configuration needed!

## What to check first

After running for a minute:

```bash
# See if events are being captured
node packages/cli/bin/tokenlens.js today

# Poke the HTTP API directly
curl http://localhost:7843/api/snapshot | python3 -m json.tool
```

## Monorepo layout

```
tokenlens/
├── packages/
│   ├── core/      # watcher, adapters, store, pricing, gamification
│   ├── tui/       # Ink terminal UI
│   ├── web/       # HTML dashboard + WebSocket server
│   └── cli/       # the `tokenlens` binary (entry point)
├── SPEC.md        # architecture & roadmap
└── GETTING_STARTED.md
```

## How to add a new adapter

1. Create `packages/core/src/adapters/my-tool.js` exporting a class with `start()` and `stop()` methods
2. Each adapter should emit `event:new` on the bus with a `UsageEvent` shape (see `adapters/claude-code.js` for the canonical example)
3. Register it in `packages/core/src/watcher.js`

The normalized event shape:

```js
{
  id: string,                // unique, stable hash
  source: string,            // 'claude-code' | 'codex-cli' | 'cursor' | your adapter
  sessionId: string,
  timestamp: number,         // epoch ms
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  reasoningTokens: number,
  cost: number,              // USD, computed via calculateCost()
  projectPath: string | null,
  toolName: string | null
}
```

## What's shipping in v0.1 vs later

- ✅ **v0.1**: Claude Code adapter, TUI, web dashboard, gamification engine
- ✅ **v0.2**: Full Codex adapter with cumulative-to-delta conversion, unified multi-tool view, historical trends
- 🚧 **v0.4**: VS Code extension (the web bundle embeds cleanly in a webview)
- 🚧 **v0.5**: Cursor adapter (Admin API integration for Enterprise)
- 🚧 **v1.0**: Team mode (aggregation server, Docker image)

See `SPEC.md` for the full roadmap.

## License

MIT © sonichigo

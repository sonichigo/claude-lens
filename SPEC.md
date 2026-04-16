# TokenLens — real-time token meter for AI coding agents

> The GitLens-style observability layer for Claude Code, Codex, and Cursor. One `npx` command, three surfaces (terminal, browser, VS Code), live data.

## Why this, why now

The AI coding tool market has exploded, but usage visibility hasn't kept up. Developers on Max/Pro subscriptions are flying blind — the provider UIs show aggregate monthly numbers at best, and existing tools solve only slices of the problem:

| Tool | Surface | Realtime | Multi-agent | Team view |
|---|---|---|---|---|
| `ccusage` | CLI reports | No | Claude + Codex | No |
| `cctv` | TUI | Yes | Claude only | No |
| `claude-devtools` | Desktop | No | Claude only | No |
| Cursor dashboard | Web | No | Cursor only | Enterprise only |
| **TokenLens** | TUI + Web + VS Code | Yes | Claude + Codex + Cursor | Yes |

The thesis: developers don't want three monitoring tools — they want one pane of glass across every agent they use, with a real-time pulse they can glance at while coding.

## What it does

### Personal mode (default)
Single developer, runs on their laptop. Reads local log files. Zero config.

```bash
npx tokenlens             # launches TUI
npx tokenlens web         # opens browser dashboard at localhost:7843
npx tokenlens --vscode    # prints install command for VS Code extension
```

### Team mode
Self-hosted aggregation server. Each developer's laptop ships anonymized deltas to the server. Managers see spend-per-dev, model choice anomalies, burn rates. No code or prompt content ever leaves the laptop — tokens and costs only.

```bash
npx tokenlens server --port 4000              # on the shared host
TOKENLENS_SERVER=https://meter.acme.dev npx tokenlens   # on each laptop
```

## The three surfaces

All three talk to the same local watcher daemon over a WebSocket + REST API. The daemon runs on demand; there's no always-on service.

### 1. Terminal UI (`npx tokenlens`)
Four-pane split view. Built on Ink (React for CLIs) so the codebase is shared with the web dashboard. Runs in a second terminal next to your agent session.

```
┌─ Live ─────────────────────┬─ 5h block ─────────────────┐
│ ● claude-code              │ ███████▓░░  72%            │
│   sonnet-4.6               │ $4.21 / $5.85 budget       │
│   12,847 in  /  3,209 out  │ resets in 1h 14m           │
│   [Edit] src/api/auth.ts   │                            │
├─ Today ────────────────────┼─ Quota ────────────────────┤
│ claude-code  $8.42  412k   │ Pro: 88% used              │
│ codex-cli    $2.11  104k   │ Rate limit OK              │
│ cursor       $1.80   52k   │ Expensive model: 0 alerts  │
└────────────────────────────┴────────────────────────────┘
```

### 2. Web dashboard (`npx tokenlens web`)
Auto-opens browser at `localhost:7843`. Single-page app. Charts for trends (Chart.js, not D3 — we want fast cold-start), session drill-downs, cost breakdowns by project/model/day. Dark mode by default. Auto-refreshes every 5s via WebSocket — no polling.

### 3. VS Code extension
Sidebar panel + status bar item. The status bar shows `$2.14 · sonnet-4.6 · 72% block` at all times. Click the status bar to open the sidebar panel, which is the web dashboard embedded in a webview. Zero separate build — reuses the web bundle.

## Architecture

```
┌─────────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│  Adapters (tail JSONL)  │──▶│   Normalizer         │──▶│  SQLite store    │
│  ├─ claude-code         │   │   (unified schema)   │   │  + pricing cache │
│  ├─ codex-cli           │   └──────────────────────┘   └────────┬─────────┘
│  └─ cursor (API)        │                                       │
└─────────────────────────┘                                       ▼
                                                          ┌──────────────────┐
                                                          │   Event bus      │
                                                          │   WS + REST      │
                                                          └────────┬─────────┘
                                          ┌──────────────────────┬─┴─────────────┐
                                          ▼                      ▼               ▼
                                    TUI (Ink)          Web (React + Vite)   VS Code (webview)
```

### Data sources — what's readable and how

**Claude Code** — `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
Each line is a JSON record. Assistant records contain:
```json
{
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 456,
      "cache_creation_input_tokens": 8000,
      "cache_read_input_tokens": 12000
    }
  },
  "timestamp": "2026-04-16T10:23:45.123Z",
  "sessionId": "...",
  "cwd": "/Users/me/proj"
}
```
Watch strategy: `chokidar` on the projects directory, incremental file tailing with byte offsets persisted to SQLite so we can resume without re-parsing on restart.

**Codex CLI** — `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
Token data comes from `event_msg` records where `payload.type === "token_count"`. **Important:** Codex reports *cumulative* totals per session — the adapter must maintain a running state and compute deltas. Model comes from `turn_context` metadata. Cost calculation needs the LiteLLM pricing dataset (same source ccusage uses).

**Cursor** — no useful local logs (this is the gotcha)
Two-tier approach:
- Personal mode: scrape the user's Cursor dashboard via their session cookie (best-effort, fragile). Alternative: just flag Cursor as "partial" and show a button that opens `cursor.com/dashboard` in a new tab.
- Team mode: official [Cursor Admin API](https://cursor.com/docs/api) (Enterprise only). Full fidelity — per-user spend, model breakdown, anomaly data.

Document this limitation clearly in the README. It's not a flaw in TokenLens; it's a platform constraint.

### Normalized schema

Everything collapses into a single event shape:

```typescript
type UsageEvent = {
  id: string;                    // hash(source + sessionId + timestamp + n)
  source: 'claude-code' | 'codex-cli' | 'cursor';
  sessionId: string;
  timestamp: number;             // epoch ms
  model: string;                 // normalized (e.g. 'claude-sonnet-4-6', 'gpt-5-codex')
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning?: number;          // codex only
  };
  cost: number;                  // USD, computed from pricing table
  projectPath?: string;          // cwd, if available
  toolName?: string;             // last tool call (Edit, Bash, Read…)
};
```

### Pricing
Bundle a pricing table at build time (fetched from LiteLLM's dataset). Refresh weekly via a GitHub Action that opens a PR. Offline mode uses the cached table. Subscription plans (Pro, Max) show both API-equivalent cost *and* subscription-burn percentage — these are different numbers and conflating them is the single biggest UX mistake existing tools make.

### Storage
SQLite at `~/.tokenlens/store.db`. Three tables: `events`, `sessions`, `file_offsets`. Events table is append-only with a rolling 90-day retention by default. Queries go through a thin repository layer — no ORM, just prepared statements.

## Package structure (monorepo, pnpm workspaces)

```
tokenlens/
├── packages/
│   ├── core/          # adapters, normalizer, storage, event bus
│   ├── tui/           # Ink-based terminal UI
│   ├── web/           # React + Vite web dashboard
│   ├── vscode/        # VS Code extension (wraps web bundle)
│   ├── server/        # optional team-mode aggregation server
│   └── cli/           # the `tokenlens` command that orchestrates everything
├── apps/
│   └── docs/          # docs site (Astro or similar)
└── scripts/
    └── update-pricing.ts
```

The `cli` package is what `npx tokenlens` runs. It's tiny — just argument parsing and launching the right surface. The `core` package is where 80% of the logic lives.

## Build order — ship something useful fast

**v0.1 — one source, one surface (week 1-2)**
- Claude Code adapter only
- Terminal UI only
- Personal mode only
- Ships as `npx tokenlens` with the live + today panels working

**v0.2 — the second surface (week 3)**
- Web dashboard with same data
- Historical trends (daily/weekly charts)

**v0.3 — the second source (week 4)**
- Codex adapter
- Unified view across both tools

**v0.4 — VS Code (week 5)**
- Extension that embeds the web bundle in a webview
- Status bar integration

**v0.5 — Cursor (week 6)**
- Personal-mode dashboard scraping with clear fallback messaging
- Admin API integration behind a feature flag

**v1.0 — team mode (week 7-8)**
- Aggregation server
- Per-user views, anomaly detection, Slack alerts
- Docker compose for easy self-hosting

## Tech choices and why

| Choice | Reason |
|---|---|
| TypeScript | One language across core/TUI/web/VS Code |
| Node 20+ | `fs.watch` recursive works well, top-level await, native fetch |
| Ink | TUI with React semantics; shares component primitives with web |
| React + Vite | Fast dev loop, small prod bundle, VS Code webview compatible |
| SQLite via better-sqlite3 | Synchronous API, zero-dependency, embedded |
| chokidar | Cross-platform file watching that actually works |
| Chart.js | Lighter than Recharts or D3 for this use case |
| pnpm workspaces | Cleanest monorepo for sharing packages |

No Electron, no Rust, no Python. Single runtime, single install.

## Things that will be hard

1. **Cursor without Enterprise is a compromise.** Be honest about it in the README. Don't pretend we have data we don't.
2. **Log file growth.** Claude Code sessions can run for hours and produce MB-scale JSONL files. Adapter must tail incrementally — never re-read from the top. Persist byte offsets.
3. **Pricing drift.** Models get added and prices change. The weekly pricing refresh PR is not optional.
4. **Subscription vs API cost confusion.** If a user is on Max, showing "$127 today" is misleading — they paid a flat rate. Show both: dollar-equivalent-at-API-prices AND subscription-percentage-consumed. Two numbers, clearly labeled.
5. **Team mode privacy.** The laptop agent must ship only token counts and model names — never prompts, file paths, or tool outputs. Write this guarantee into the README and back it with a `--dry-run-network` flag that prints every outgoing byte.
6. **Windows paths.** Codex shards sessions by date; Claude Code encodes cwd into folder names. Both have gotchas on Windows. Test on Windows from day one, not at the end.

## Naming

`TokenLens` is the final name for this project.

## Distribution

- Primary: `npx tokenlens@latest` (no install, always fresh)
- Secondary: `npm i -g tokenlens` for users who want a persistent command
- VS Code extension published to the marketplace
- Team-mode server as a Docker image on GHCR

## License

MIT. The goal is ubiquity, not monetization. Team-mode server is also MIT — if someone wants a hosted SaaS version of it, that's a separate product.

---

**Next step:** spin up the monorepo, build the Claude Code adapter, ship the TUI. v0.1 in two weeks is realistic.

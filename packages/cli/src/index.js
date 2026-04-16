// src/index.js — main CLI orchestrator
import { Watcher, computeLevel } from '@tokenlens/core';
import { launchTui } from '@tokenlens/tui';
import { startWebServer } from '@tokenlens/web/src/server.js';

export async function run(cmd, args = []) {
  if (cmd === 'today') return runToday();
  if (cmd === 'scan') return runScan();
  if (cmd === 'web') return runWeb(args);

  // Default: full experience — daemon + TUI + web (in background)
  return runAll(args);
}

async function runAll(args) {
  const port = getFlag(args, '--port', 7843);
  const noWeb = args.includes('--no-web');
  const noTui = args.includes('--no-tui');

  printBanner();

  const watcher = new Watcher();
  await watcher.start();

  let webServer = null;
  if (!noWeb) {
    try {
      webServer = await startWebServer({ watcher, port });
      console.log(`\n  ● web dashboard: http://localhost:${port}`);
    } catch (err) {
      console.error(`\n  ⚠ web server failed to start on port ${port}: ${err.message}`);
    }
  }

  const shutdown = async () => {
    await watcher.stop();
    if (webServer) webServer.server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (noTui) {
    console.log('  running as daemon. Ctrl+C to stop.\n');
    // Block forever
    await new Promise(() => {});
    return;
  }

  // Small delay so the banner is visible before Ink clears the screen
  await new Promise((r) => setTimeout(r, 400));

  const { waitUntilExit } = launchTui({ watcher, onExit: shutdown });
  await waitUntilExit();
  await shutdown();
}

async function runWeb(args) {
  const port = getFlag(args, '--port', 7843);
  printBanner();
  const watcher = new Watcher();
  await watcher.start();
  await startWebServer({ watcher, port });
  console.log(`\n  ● web dashboard: http://localhost:${port}\n  Ctrl+C to stop.`);

  // Try to open the browser; non-fatal if it fails
  try {
    const { exec } = await import('node:child_process');
    const opener = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start'
      : 'xdg-open';
    exec(`${opener} http://localhost:${port}`);
  } catch {}

  process.on('SIGINT', async () => { await watcher.stop(); process.exit(0); });
  await new Promise(() => {});
}

async function runToday() {
  const watcher = new Watcher();
  await watcher.start();
  const stats = watcher.getTodayStats();
  const total = stats.reduce((s, r) => s + (r.cost || 0), 0);
  const tokens = stats.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
  const level = computeLevel(watcher.getTotalXp());

  console.log(`\n  TokenLens · today\n`);
  console.log(`  ${'source'.padEnd(16)} ${'cost'.padEnd(10)} ${'tokens'.padEnd(12)} events`);
  console.log(`  ${'─'.repeat(50)}`);
  for (const row of stats) {
    const tok = ((row.input_tokens || 0) + (row.output_tokens || 0)).toLocaleString();
    console.log(`  ${row.source.padEnd(16)} ${('$' + (row.cost || 0).toFixed(2)).padEnd(10)} ${tok.padEnd(12)} ${row.events}`);
  }
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  total: $${total.toFixed(2)} · ${tokens.toLocaleString()} tokens`);
  console.log(`  level: ${level.level} (${level.title}) · streak: ${watcher.getStreak()} days\n`);
  await watcher.stop();
}

async function runScan() {
  console.log('  scanning log directories…');
  const watcher = new Watcher();
  await watcher.start();
  // Adapter's scanExisting runs on start; just confirm and exit.
  const recent = watcher.getRecentEvents(1);
  console.log(`  done. ${recent.length > 0 ? 'latest event at ' + new Date(recent[0].timestamp).toLocaleString() : 'no events found'}\n`);
  await watcher.stop();
}

function getFlag(args, flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const n = parseInt(args[idx + 1], 10);
  return Number.isNaN(n) ? fallback : n;
}

function printBanner() {
  const o = '\x1b[38;2;255;140;50m';
  const d = '\x1b[90m';
  const r = '\x1b[0m';
  console.log(`
  ${o} _____     _             _
  ${o}|_   _|__ | | _____ _ __ | |    ___ _ __  ___
  ${o}  | |/ _ \\| |/ / _ \\ '_ \\| |   / _ \\ '_ \\/ __|
  ${o}  | | (_) |   <  __/ | | | |__|  __/ | | \\__ \\
  ${o}  |_|\\___/|_|\\_\\___|_| |_|_____|___|_| |_|___/
  ${d}   real-time meter for AI coding agents${r}
  ${d}   made with ♥ by sonichigo${r}
`);
}

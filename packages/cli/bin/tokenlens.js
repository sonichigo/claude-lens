#!/usr/bin/env node
// bin/tokenlens.js — the binary users invoke via `npx tokenlens`
// Lazy-loads heavy modules so --version/--help work without pulling in
// the whole dependency tree.
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const cmd = args[0];

if (cmd === '--version' || cmd === '-v') {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8'));
  console.log(`tokenlens v${pkg.version}`);
  exit(0);
}

if (cmd === '--help' || cmd === '-h') {
  console.log(`
  TokenLens — real-time token meter for Claude Code, Codex, Cursor

  USAGE
    tokenlens              launch terminal UI (default)
    tokenlens web          open web dashboard at localhost:7843
    tokenlens today        print today's usage and exit
    tokenlens scan         rescan all log files
    tokenlens --version    show version

  FLAGS
    --port <n>           web dashboard port (default: 7843)
    --no-tui             run daemon only, no terminal UI
    --no-web             don't auto-start the web server

  More: https://github.com/sonichigo/tokenlens
`);
  exit(0);
}

try {
  const { run } = await import('../src/index.js');
  await run(cmd, args.slice(1));
} catch (err) {
  console.error('tokenlens:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  exit(1);
}

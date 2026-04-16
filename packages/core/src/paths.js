// paths.js — cross-platform home directory resolution for TokenLens
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export function getTokenLensHome() {
  const dir = process.env.TOKENLENS_HOME || join(homedir(), '.tokenlens');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// Legacy alias for backward compatibility
export function getAimeterHome() {
  return getTokenLensHome();
}

export function getClaudeHome() {
  // Claude Code writes to ~/.claude on all platforms
  return process.env.CLAUDE_HOME || join(homedir(), '.claude');
}

export function getClaudeProjectsDir() {
  return join(getClaudeHome(), 'projects');
}

export function getCodexHome() {
  // Codex honors CODEX_HOME, defaults to ~/.codex
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

export function getCodexSessionsDir() {
  return join(getCodexHome(), 'sessions');
}

export function getStorePath() {
  return join(getTokenLensHome(), 'store.db');
}

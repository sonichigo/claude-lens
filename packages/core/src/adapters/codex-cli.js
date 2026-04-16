// codex-cli.js — adapter for OpenAI Codex CLI session logs
// Codex writes cumulative token totals per session, so we compute deltas.
import { createReadStream, statSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import chokidar from 'chokidar';
import { getCodexSessionsDir } from '../paths.js';
import { calculateCost } from '../pricing/pricing.js';

/**
 * Watches ~/.codex/sessions/YYYY/MM/DD/*.jsonl for token_count events,
 * converts cumulative totals to deltas, and emits normalized UsageEvents.
 */
export class CodexAdapter {
  constructor({ store, bus, sessionsDir }) {
    this.store = store;
    this.bus = bus;
    this.sessionsDir = sessionsDir || getCodexSessionsDir();
    this.sessionState = new Map(); // sessionId -> last cumulative totals
    this.watcher = null;
    this.processing = new Set();
  }

  async start() {
    if (!existsSync(this.sessionsDir)) {
      this.bus.emit('adapter:missing', {
        source: 'codex-cli',
        path: this.sessionsDir,
        hint: 'No Codex CLI data found. Run `codex` once to create it.',
      });
      return;
    }

    // Initial backfill — process everything we haven't seen yet
    await this.#scanExisting();

    // Watch for new and updated session files
    this.watcher = chokidar.watch(`${this.sessionsDir}/**/*.jsonl`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    this.watcher
      .on('add', (p) => this.#processFile(p))
      .on('change', (p) => this.#processFile(p))
      .on('error', (err) => this.bus.emit('adapter:error', { source: 'codex-cli', err: err.message }));

    this.bus.emit('adapter:ready', { source: 'codex-cli' });
  }

  async stop() {
    if (this.watcher) await this.watcher.close();
  }

  async #scanExisting() {
    const glob = await import('node:fs/promises');
    const walk = async (dir) => {
      if (!existsSync(dir)) return [];
      const out = [];
      const entries = await glob.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(full)));
        else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
      }
      return out;
    };
    const files = await walk(this.sessionsDir);
    for (const f of files) await this.#processFile(f);
  }

  async #processFile(filePath) {
    if (this.processing.has(filePath)) return;
    this.processing.add(filePath);

    try {
      const stats = statSync(filePath);
      const offset = this.store.getFileOffset(filePath);
      if (offset >= stats.size) return;

      const stream = createReadStream(filePath, { start: offset, encoding: 'utf8' });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      let newOffset = offset;
      const events = [];

      for await (const line of rl) {
        newOffset += Buffer.byteLength(line, 'utf8') + 1; // +1 for newline
        if (!line.trim()) continue;

        try {
          const record = JSON.parse(line);
          const event = this.#normalize(record, filePath);
          if (event) events.push(event);
        } catch {
          // corrupt line — skip silently
        }
      }

      if (events.length > 0) {
        this.store.recordBatch(events);
        for (const e of events) this.bus.emit('event:new', e);
      }

      this.store.setFileOffset(filePath, newOffset);
    } catch (err) {
      this.bus.emit('adapter:error', { source: 'codex-cli', file: filePath, err: err.message });
    } finally {
      this.processing.delete(filePath);
    }
  }

  /**
   * Convert a Codex JSONL record into a UsageEvent.
   * Only event_msg records with type=token_count produce events.
   * Codex reports cumulative totals, so we compute deltas.
   */
  #normalize(record, filePath) {
    // Look for token_count events
    if (record.event_msg?.payload?.type !== 'token_count') return null;

    const payload = record.event_msg.payload;
    const sessionId = record.session_id || basename(filePath, '.jsonl');

    // Extract cumulative totals from the payload
    const cumulative = {
      input: payload.input_tokens || 0,
      output: payload.output_tokens || 0,
      cacheRead: payload.cache_read_tokens || 0,
      reasoning: payload.reasoning_tokens || 0,
    };

    // Compute delta from last known state
    const delta = this.#computeDelta(sessionId, cumulative);

    // Skip if no actual change (happens with duplicate events)
    if (delta.input === 0 && delta.output === 0 && delta.cacheRead === 0 && delta.reasoning === 0) {
      return null;
    }

    // Extract model from turn_context or metadata
    const model = record.turn_context?.model || payload.model || 'gpt-4-turbo';

    const tokens = {
      input: delta.input,
      output: delta.output,
      cacheRead: delta.cacheRead,
      cacheWrite: 0, // Codex doesn't expose cache creation
      reasoning: delta.reasoning,
    };

    const cost = calculateCost(model, tokens);
    const timestamp = record.timestamp ? new Date(record.timestamp).getTime() : Date.now();

    const id = createHash('sha1')
      .update(`codex:${sessionId}:${timestamp}:${delta.input}:${delta.output}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id,
      source: 'codex-cli',
      sessionId,
      timestamp,
      model,
      inputTokens: delta.input,
      outputTokens: delta.output,
      cacheReadTokens: delta.cacheRead,
      cacheWriteTokens: 0,
      reasoningTokens: delta.reasoning,
      cost,
      projectPath: record.cwd || payload.cwd || null,
      toolName: payload.tool_name || null,
    };
  }

  #computeDelta(sessionId, cumulative) {
    const prev = this.sessionState.get(sessionId) || {
      input: 0,
      output: 0,
      cacheRead: 0,
      reasoning: 0,
    };

    const delta = {
      input: Math.max(0, cumulative.input - prev.input),
      output: Math.max(0, cumulative.output - prev.output),
      cacheRead: Math.max(0, cumulative.cacheRead - prev.cacheRead),
      reasoning: Math.max(0, cumulative.reasoning - prev.reasoning),
    };

    this.sessionState.set(sessionId, cumulative);
    return delta;
  }
}

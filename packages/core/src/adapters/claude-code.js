// claude-code.js — adapter that tails Claude Code session JSONL files
import { createReadStream, statSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename } from 'node:path';
import chokidar from 'chokidar';
import { createHash } from 'node:crypto';
import { getClaudeProjectsDir } from '../paths.js';
import { calculateCost } from '../pricing/pricing.js';

/**
 * Watches ~/.claude/projects/** for JSONL updates, parses assistant events,
 * emits normalized UsageEvents to the bus, and persists offsets so we
 * resume cleanly on restart.
 */
export class ClaudeCodeAdapter {
  constructor({ store, bus, projectsDir }) {
    this.store = store;
    this.bus = bus;
    this.projectsDir = projectsDir || getClaudeProjectsDir();
    this.watcher = null;
    this.processing = new Set();
  }

  async start() {
    if (!existsSync(this.projectsDir)) {
      this.bus.emit('adapter:missing', {
        source: 'claude-code',
        path: this.projectsDir,
        hint: 'No Claude Code data found. Run `claude` once to create it.',
      });
      return;
    }

    // Initial backfill — process everything we haven't seen yet
    await this.#scanExisting();

    // Then watch for future changes
    this.watcher = chokidar.watch(`${this.projectsDir}/**/*.jsonl`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    this.watcher
      .on('add', (p) => this.#processFile(p))
      .on('change', (p) => this.#processFile(p))
      .on('error', (err) => this.bus.emit('adapter:error', { source: 'claude-code', err: err.message }));

    this.bus.emit('adapter:ready', { source: 'claude-code' });
  }

  async stop() {
    if (this.watcher) await this.watcher.close();
  }

  async #scanExisting() {
    const glob = await import('node:fs/promises');
    const walk = async (dir) => {
      const out = [];
      const entries = await glob.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(full)));
        else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
      }
      return out;
    };
    const files = await walk(this.projectsDir);
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
          // corrupt line — skip silently, common at file boundaries
        }
      }

      if (events.length > 0) {
        this.store.recordBatch(events);
        for (const e of events) this.bus.emit('event:new', e);
      }

      this.store.setFileOffset(filePath, newOffset);
    } catch (err) {
      this.bus.emit('adapter:error', { source: 'claude-code', file: filePath, err: err.message });
    } finally {
      this.processing.delete(filePath);
    }
  }

  /**
   * Convert a raw Claude Code JSONL record into the unified UsageEvent shape.
   * Only assistant messages with usage data produce events.
   */
  #normalize(record, filePath) {
    const msg = record.message;
    if (!msg || msg.role !== 'assistant' || !msg.usage) return null;

    const u = msg.usage;
    const tokens = {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
    };

    const model = msg.model || 'claude-unknown';
    const cost = calculateCost(model, tokens);
    const timestamp = record.timestamp ? new Date(record.timestamp).getTime() : Date.now();

    // Extract last tool call from content array, if any
    let toolName = null;
    if (Array.isArray(msg.content)) {
      const tool = msg.content.find((c) => c.type === 'tool_use');
      if (tool) toolName = tool.name;
    }

    const id = createHash('sha1')
      .update(`${record.sessionId || basename(filePath)}:${timestamp}:${record.uuid || ''}`)
      .digest('hex')
      .slice(0, 16);

    return {
      id,
      source: 'claude-code',
      sessionId: record.sessionId || basename(filePath, '.jsonl'),
      timestamp,
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cacheReadTokens: tokens.cacheRead,
      cacheWriteTokens: tokens.cacheWrite,
      reasoningTokens: 0,
      cost,
      projectPath: record.cwd || null,
      toolName,
    };
  }
}

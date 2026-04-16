// store.js — SQLite-backed storage for usage events and watcher state
import Database from 'better-sqlite3';
import { getStorePath } from '../paths.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  project_path TEXT,
  tool_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_source_ts ON events(source, timestamp DESC);

CREATE TABLE IF NOT EXISTS file_offsets (
  path TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  unlocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  quests_completed TEXT NOT NULL DEFAULT '[]'
);
`;

export class Store {
  constructor(path) {
    this.db = new Database(path || getStorePath());
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(SCHEMA);
    this.#prepareStatements();
  }

  #prepareStatements() {
    this.insertEvent = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        id, source, session_id, timestamp, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        reasoning_tokens, cost, project_path, tool_name
      ) VALUES (
        @id, @source, @sessionId, @timestamp, @model,
        @inputTokens, @outputTokens, @cacheReadTokens, @cacheWriteTokens,
        @reasoningTokens, @cost, @projectPath, @toolName
      )
    `);

    this.getOffset = this.db.prepare('SELECT byte_offset FROM file_offsets WHERE path = ?');
    this.setOffset = this.db.prepare(`
      INSERT INTO file_offsets (path, byte_offset, last_seen) VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET byte_offset = excluded.byte_offset, last_seen = excluded.last_seen
    `);

    this.recentEvents = this.db.prepare(`
      SELECT * FROM events ORDER BY timestamp DESC LIMIT ?
    `);

    this.eventsSince = this.db.prepare(`
      SELECT * FROM events WHERE timestamp >= ? ORDER BY timestamp ASC
    `);

    this.todaysAggregates = this.db.prepare(`
      SELECT
        source,
        COUNT(*) as events,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_read_tokens) as cache_read_tokens,
        SUM(cache_write_tokens) as cache_write_tokens,
        SUM(cost) as cost
      FROM events
      WHERE timestamp >= ?
      GROUP BY source
    `);

    this.modelBreakdown = this.db.prepare(`
      SELECT model, SUM(input_tokens + output_tokens) as total, SUM(cost) as cost, COUNT(*) as calls
      FROM events
      WHERE timestamp >= ?
      GROUP BY model
      ORDER BY total DESC
    `);

    this.insertAchievement = this.db.prepare(
      'INSERT OR IGNORE INTO achievements (id, unlocked_at) VALUES (?, ?)'
    );
    this.listAchievements = this.db.prepare(
      'SELECT id, unlocked_at FROM achievements ORDER BY unlocked_at DESC'
    );
  }

  record(event) {
    this.insertEvent.run(event);
  }

  recordBatch(events) {
    const tx = this.db.transaction((items) => {
      for (const e of items) this.insertEvent.run(e);
    });
    tx(events);
  }

  getFileOffset(path) {
    const row = this.getOffset.get(path);
    return row ? row.byte_offset : 0;
  }

  setFileOffset(path, offset) {
    this.setOffset.run(path, offset, Date.now());
  }

  recent(limit = 50) {
    return this.recentEvents.all(limit);
  }

  since(ts) {
    return this.eventsSince.all(ts);
  }

  todayAggregates(startOfDayTs) {
    return this.todaysAggregates.all(startOfDayTs);
  }

  models(sinceTs) {
    return this.modelBreakdown.all(sinceTs);
  }

  unlockAchievement(id) {
    this.insertAchievement.run(id, Date.now());
  }

  achievements() {
    return this.listAchievements.all();
  }

  close() {
    this.db.close();
  }
}

// watcher.js — top-level orchestrator that starts adapters and manages lifecycle
import { Store } from './store/store.js';
import { EventBus } from './events/bus.js';
import { ClaudeCodeAdapter } from './adapters/claude-code.js';
import { CodexAdapter } from './adapters/codex-cli.js';
import { CursorAdapter } from './adapters/cursor.js';
import { xpForEvent, checkAchievements, computeStreak } from './gamification/engine.js';

export class Watcher {
  constructor(config = {}) {
    this.store = config.store || new Store();
    this.bus = config.bus || new EventBus();
    this.config = config;
    this.totalXp = 0;
    this.editsToday = 0;
    this.haikuCalls = 0;
    this.adapters = [];
  }

  async start() {
    this.adapters = [
      new ClaudeCodeAdapter({ store: this.store, bus: this.bus }),
      new CodexAdapter({ store: this.store, bus: this.bus }),
      new CursorAdapter({ store: this.store, bus: this.bus, config: this.config.cursor || {} }),
    ];

    // Wire gamification side-effects onto incoming events
    this.bus.on('event:new', (event) => this.#handleEvent(event));

    for (const adapter of this.adapters) {
      await adapter.start();
    }

    this.bus.emit('watcher:ready', { adapters: this.adapters.length });
  }

  async stop() {
    for (const adapter of this.adapters) {
      await adapter.stop();
    }
    this.store.close();
  }

  #handleEvent(event) {
    // Gamification
    const xp = xpForEvent(event);
    this.totalXp += xp;
    if (event.toolName === 'Edit' || event.toolName === 'Write') this.editsToday += 1;
    if (event.model.includes('haiku')) this.haikuCalls += 1;

    const context = {
      editsToday: this.editsToday,
      haikuCalls: this.haikuCalls,
      streakDays: computeStreak(this.store),
      nightOwlDays: 0, // TODO: track in daily_stats
      sessionCacheRatio: 0, // TODO: session-level aggregate
    };

    const unlocked = checkAchievements(this.store, event, context);
    for (const id of unlocked) {
      this.bus.emit('achievement:unlocked', { id, at: Date.now() });
    }

    if (xp > 0) this.bus.emit('xp:earned', { xp, total: this.totalXp });
  }

  // ─── Public query API ────────────────────────────────────────────────────
  getRecentEvents(limit = 20) {
    return this.store.recent(limit);
  }

  getTodayStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.store.todayAggregates(startOfDay.getTime());
  }

  getModelBreakdown(sinceMs) {
    return this.store.models(sinceMs || Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  getAchievements() {
    return this.store.achievements();
  }

  getStreak() {
    return computeStreak(this.store);
  }

  getTotalXp() {
    return this.totalXp;
  }
}

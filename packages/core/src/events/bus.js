// bus.js — tiny event emitter shared across adapters and UI surfaces
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event, payload) {
    const subs = this.listeners.get(event);
    if (!subs) return;
    for (const fn of subs) {
      try { fn(payload); } catch (err) { console.error(`[bus] ${event}:`, err.message); }
    }
  }
}

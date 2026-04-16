// cursor.js — adapter for Cursor usage data
// Status: v0.5 target. Cursor has no useful local logs; requires Admin API (Enterprise)
// or dashboard scraping. We're honest about this constraint.
export class CursorAdapter {
  constructor({ store, bus, config = {} }) {
    this.store = store;
    this.bus = bus;
    this.config = config;
  }

  async start() {
    const hasEnterpriseKey = !!this.config.adminApiKey;
    if (!hasEnterpriseKey) {
      this.bus.emit('adapter:missing', {
        source: 'cursor',
        hint: 'Cursor requires Enterprise Admin API for full data. See docs/cursor.md',
        fallback: 'Open https://cursor.com/dashboard manually for personal usage.',
      });
      return;
    }

    // TODO v0.5: poll Cursor Admin API every 10 minutes
    this.bus.emit('adapter:stub', { source: 'cursor', version: 'v0.5' });
  }

  async stop() {}
}

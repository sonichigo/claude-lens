// server.js — lightweight HTTP + WebSocket server for the web dashboard
// Deliberately uses zero web framework. Node's http + ws is enough for a
// single-file localhost tool and keeps cold-start fast.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';
import { computeLevel, dailyQuests } from '@tokenlens/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

export async function startWebServer({ watcher, port = 7843 }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/api/snapshot') {
      return json(res, snapshot(watcher));
    }

    if (url.pathname === '/api/events') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      return json(res, watcher.getRecentEvents(limit));
    }

    // Static file serve — only index.html in v0.1
    try {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const content = await readFile(join(PUBLIC_DIR, file));
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': type });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'snapshot', data: snapshot(watcher) }));

    const forward = (type) => (payload) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type, data: payload, snap: snapshot(watcher) }));
    };
    const offEvent = watcher.bus.on('event:new', forward('event'));
    const offXp = watcher.bus.on('xp:earned', forward('xp'));
    const offAch = watcher.bus.on('achievement:unlocked', forward('achievement'));

    ws.on('close', () => { offEvent(); offXp(); offAch(); });
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return { server, wss, port };
}

function snapshot(watcher) {
  const totalXp = watcher.getTotalXp();
  const level = computeLevel(totalXp);
  return {
    level,
    totalXp,
    streak: watcher.getStreak(),
    quests: dailyQuests(),
    achievements: watcher.getAchievements(),
    todayStats: watcher.getTodayStats(),
    recent: watcher.getRecentEvents(20),
    models: watcher.getModelBreakdown(),
  };
}

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// BossFight.js — the 5-hour block rendered as a boss fight HP bar
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const BLOCK_HOURS = 5;
const BLOCK_BUDGET_USD = 5.85;

function currentBlockStart(now = Date.now()) {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  const hour = d.getUTCHours();
  d.setUTCHours(Math.floor(hour / BLOCK_HOURS) * BLOCK_HOURS);
  return d.getTime();
}

function formatTimeLeft(ms) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function HpBar({ percent, width = 22 }) {
  const filled = Math.min(width, Math.floor(percent * width));
  const empty = width - filled;
  return h(Box, null,
    h(Text, { color: '#ff8c32' }, '█'.repeat(filled)),
    h(Text, { color: 'gray' }, '░'.repeat(empty)),
  );
}

export function BossFight({ todayStats = [] }) {
  const blockEnd = currentBlockStart() + BLOCK_HOURS * 3_600_000;
  const todayCost = todayStats.reduce((sum, s) => sum + (s.cost || 0), 0);
  const percent = Math.min(1, todayCost / BLOCK_BUDGET_USD);
  const hpPercent = Math.round(percent * 100);

  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, flexDirection: 'column', minHeight: 9,
  },
    h(Text, { color: '#ff8c32' }, '▸ 5H BLOCK · BOSS FIGHT'),
    h(Box, { marginTop: 1 },
      h(Text, { color: 'white', bold: true }, `$${todayCost.toFixed(2)}`),
      h(Text, { color: 'gray' }, ` / $${BLOCK_BUDGET_USD.toFixed(2)} budget`),
    ),
    h(Box, { marginTop: 1 }, h(HpBar, { percent })),
    h(Box, { justifyContent: 'space-between' },
      h(Text, { color: 'gray' }, `${hpPercent}% HP used`),
      h(Text, { color: 'gray' }, `resets in ${formatTimeLeft(blockEnd - Date.now())}`),
    ),
    h(Box, { marginTop: 1 },
      h(Text, { color: '#ffb366' }, '⚡ cache hits active'),
      h(Text, { color: 'gray' }, ' · projected '),
      h(Text, { color: 'white' }, `${Math.min(100, Math.round(hpPercent * 1.3))}%`),
    ),
  );
}

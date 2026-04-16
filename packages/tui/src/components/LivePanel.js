// LivePanel.js — the "now playing" card with a live sparkline
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function sparkline(values) {
  const bars = '▁▂▃▄▅▆▇█';
  if (!values.length) return '▁'.repeat(18);
  const max = Math.max(...values, 1);
  return values.slice(-18)
    .map((v) => bars[Math.min(bars.length - 1, Math.floor((v / max) * (bars.length - 1)))])
    .join('');
}

export function LivePanel({ recent }) {
  const latest = recent[0];
  const tokensPerMin = recent
    .filter((e) => Date.now() - e.timestamp < 60_000)
    .reduce((sum, e) => sum + e.input_tokens + e.output_tokens, 0);

  const sparkValues = recent.slice(0, 18).reverse().map((e) => e.input_tokens + e.output_tokens);

  if (!latest) {
    return h(Box, {
      borderStyle: 'round', borderColor: '#ff8c32',
      paddingX: 1, flexDirection: 'column', minHeight: 9,
    },
      h(Text, { color: '#ff8c32' }, '▸ NOW PLAYING'),
      h(Box, { marginTop: 1 }, h(Text, { color: 'gray' }, 'waiting for activity…')),
      h(Box, { marginTop: 1 }, h(Text, { color: 'gray' }, 'open a Claude Code session to see events stream in')),
    );
  }

  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, flexDirection: 'column', minHeight: 9,
  },
    h(Text, { color: '#ff8c32' }, '▸ NOW PLAYING'),
    h(Text, { color: 'white', bold: true }, `${latest.source} · ${latest.model}`),
    h(Text, { color: 'gray' }, latest.project_path || '(no project)'),
    h(Text, { color: 'gray' }, `⚒ ${latest.tool_name || 'response'} · ${relativeTime(latest.timestamp)}`),
    h(Box, { marginTop: 1 }, h(Text, { color: 'gray' }, 'tokens/min')),
    h(Text, { color: '#ffb366', bold: true }, tokensPerMin.toLocaleString()),
    h(Text, { color: '#ff8c32' }, sparkline(sparkValues)),
  );
}

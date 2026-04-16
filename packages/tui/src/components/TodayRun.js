// TodayRun.js — today's per-tool breakdown with XP bar
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

function XpBar({ progress, width = 34 }) {
  const filled = Math.min(width, Math.floor(progress * width));
  return h(Box, null,
    h(Text, { color: '#ff8c32' }, '█'.repeat(filled)),
    h(Text, { color: 'gray' }, '░'.repeat(width - filled)),
  );
}

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const SOURCES = ['claude-code', 'codex-cli', 'cursor'];

export function TodayRun({ todayStats = [], level }) {
  const bySource = Object.fromEntries(todayStats.map((s) => [s.source, s]));

  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, flexDirection: 'column',
  },
    h(Box, { justifyContent: 'space-between' },
      h(Text, { color: '#ff8c32' }, '▸ TODAY\'S RUN'),
      h(Text, { color: 'gray' },
        `XP ${level.intoLevel.toLocaleString()} / ${level.needed.toLocaleString()} to Lv.${level.level + 1}`),
    ),
    h(Box, { marginTop: 1 }, h(XpBar, { progress: level.progress })),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      h(Box, null,
        h(Box, { width: 16 }, h(Text, { color: 'gray' }, 'tool')),
        h(Box, { width: 10 }, h(Text, { color: 'gray' }, 'cost')),
        h(Box, { width: 12 }, h(Text, { color: 'gray' }, 'tokens')),
        h(Box, { width: 8 }, h(Text, { color: 'gray' }, 'calls')),
      ),
      ...SOURCES.map((key) => {
        const row = bySource[key];
        const cost = row ? (row.cost || 0) : 0;
        const tokens = row ? (row.input_tokens || 0) + (row.output_tokens || 0) : 0;
        const calls = row ? row.events || 0 : 0;
        return h(Box, { key },
          h(Box, { width: 16 }, h(Text, { color: '#ffb366' }, key)),
          h(Box, { width: 10 }, h(Text, { color: 'white' }, `$${cost.toFixed(2)}`)),
          h(Box, { width: 12 }, h(Text, { color: 'white' }, formatTokens(tokens))),
          h(Box, { width: 8 }, h(Text, { color: 'white' }, String(calls))),
        );
      }),
    ),
  );
}

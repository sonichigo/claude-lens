// Achievements.js — the achievements panel with the latest unlock highlighted
import React from 'react';
import { Box, Text } from 'ink';
import { ACHIEVEMENTS } from '@tokenlens/core/src/gamification/engine.js';

const h = React.createElement;

export function Achievements({ unlocked = [] }) {
  const unlockedIds = new Set(unlocked.map((u) => u.id));
  const total = Object.keys(ACHIEVEMENTS).length;
  const latest = unlocked[0];

  const latestBlock = latest
    ? h(Box, { marginTop: 1, flexDirection: 'column' },
        h(Box, null,
          h(Text, { color: '#ffb366', bold: true },
            `${ACHIEVEMENTS[latest.id]?.icon || '★'} ${ACHIEVEMENTS[latest.id]?.name || latest.id}`),
          h(Text, { color: 'gray' }, ' · unlocked'),
        ),
        h(Text, { color: 'gray' }, ACHIEVEMENTS[latest.id]?.desc || ''),
      )
    : h(Box, { marginTop: 1 },
        h(Text, { color: 'gray' }, 'no unlocks yet — start coding'),
      );

  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, flexDirection: 'column', minHeight: 7,
  },
    h(Text, { color: '#ff8c32' }, `▸ ACHIEVEMENTS · ${unlocked.length}/${total}`),
    latestBlock,
    h(Box, { marginTop: 1, flexWrap: 'wrap' },
      ...Object.entries(ACHIEVEMENTS).slice(0, 6).map(([id, meta]) => {
        const isUnlocked = unlockedIds.has(id);
        return h(Box, { key: id, marginRight: 1 },
          h(Text, { color: isUnlocked ? 'green' : 'gray' },
            `${isUnlocked ? '●' : '○'} ${meta.name}`),
        );
      }),
    ),
  );
}

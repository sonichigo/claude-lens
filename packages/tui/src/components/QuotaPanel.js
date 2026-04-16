// QuotaPanel.js — quota indicator + daily quests
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

function QuotaBar({ percent, width = 22 }) {
  const filled = Math.min(width, Math.floor(percent * width));
  return h(Box, null,
    h(Text, { color: '#ff8c32' }, '█'.repeat(filled)),
    h(Text, { color: 'gray' }, '░'.repeat(width - filled)),
  );
}

export function QuotaPanel({ todayStats = [], quests = [] }) {
  const todayCost = todayStats.reduce((sum, s) => sum + (s.cost || 0), 0);
  const percent = Math.min(1, todayCost / 50); // $50/day nominal cap, configurable

  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, flexDirection: 'column', minHeight: 7,
  },
    h(Text, { color: '#ff8c32' }, '▸ QUOTA & QUESTS'),
    h(Box, { marginTop: 1, justifyContent: 'space-between' },
      h(Text, { color: 'gray' }, 'daily spend'),
      h(Text, { color: '#ffb366' }, `${Math.round(percent * 100)}%`),
    ),
    h(Box, null, h(QuotaBar, { percent })),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      ...quests.slice(0, 3).map((q) =>
        h(Box, { key: q.id },
          h(Text, { color: 'gray' }, '○ '),
          h(Text, { color: 'white' }, q.name),
          h(Text, { color: '#ffb366' }, ` +${q.xp}`),
        ),
      ),
    ),
  );
}

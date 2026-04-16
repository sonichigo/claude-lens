// Header.js — top bar: logo, level, streak, live indicator
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

export function Header({ level, streak }) {
  return h(Box, {
    borderStyle: 'round', borderColor: '#ff8c32',
    paddingX: 1, justifyContent: 'space-between', marginBottom: 1,
  },
    h(Box, null,
      h(Text, { color: '#ff8c32', bold: true }, '◉ TokenLens'),
      h(Text, { color: 'gray' }, ' v0.1.0'),
    ),
    h(Box, null,
      h(Text, { color: '#ffb366' }, `Lv.${level.level} ${level.title}`),
      h(Text, { color: 'gray' }, '  │  '),
      h(Text, { color: '#ffb366' }, `🔥 ${streak}-day streak`),
      h(Text, { color: 'gray' }, '  │  '),
      h(Text, { color: 'green' }, '● live'),
    ),
  );
}

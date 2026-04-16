// Footer.js — keybindings + byline
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

export function Footer() {
  return h(Box, { marginTop: 1, justifyContent: 'space-between' },
    h(Box, null,
      h(Text, { color: '#ff8c32' }, '[q]'),
      h(Text, { color: 'gray' }, ' quit  '),
      h(Text, { color: '#ff8c32' }, '[w]'),
      h(Text, { color: 'gray' }, ' web  '),
      h(Text, { color: '#ff8c32' }, '[r]'),
      h(Text, { color: 'gray' }, ' refresh'),
    ),
    h(Text, { color: 'gray' }, 'made with ♥ by sonichigo'),
  );
}

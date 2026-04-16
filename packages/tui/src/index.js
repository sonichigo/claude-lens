// index.js — entry point for the TokenLens TUI
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';

export function launchTui({ watcher, onExit }) {
  const { waitUntilExit, unmount } = render(React.createElement(App, { watcher, onExit }));
  return { waitUntilExit, unmount };
}

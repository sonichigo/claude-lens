// App.js — main TUI layout. Uses React.createElement directly so Node runs
// it with no build step (no JSX pipeline required).
import React, { useEffect, useReducer, useCallback } from 'react';
import { Box, useApp, useInput } from 'ink';
import { computeLevel, dailyQuests } from '@tokenlens/core';
import { LivePanel } from './LivePanel.js';
import { BossFight } from './BossFight.js';
import { TodayRun } from './TodayRun.js';
import { Achievements } from './Achievements.js';
import { QuotaPanel } from './QuotaPanel.js';
import { Header } from './Header.js';
import { Footer } from './Footer.js';

const h = React.createElement;

const initialState = {
  recentEvents: [], todayStats: [], achievements: [],
  totalXp: 0, streak: 0, lastUnlocked: null, tick: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'refresh': return { ...state, ...action.data, tick: state.tick + 1 };
    case 'unlock': return { ...state, lastUnlocked: action.id };
    default: return state;
  }
}

export function App({ watcher, onExit }) {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(() => {
    dispatch({
      type: 'refresh',
      data: {
        recentEvents: watcher.getRecentEvents(10),
        todayStats: watcher.getTodayStats(),
        achievements: watcher.getAchievements(),
        totalXp: watcher.getTotalXp(),
        streak: watcher.getStreak(),
      },
    });
  }, [watcher]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const offEvent = watcher.bus.on('event:new', () => refresh());
    const offXp = watcher.bus.on('xp:earned', () => refresh());
    const offAch = watcher.bus.on('achievement:unlocked', ({ id }) => {
      dispatch({ type: 'unlock', id });
      refresh();
    });
    return () => { offEvent(); offXp(); offAch(); };
  }, [watcher, refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  useInput((input) => {
    if (input === 'q' || input === '\u0003') { exit(); onExit?.(); }
    if (input === 'r') refresh();
  });

  const level = computeLevel(state.totalXp);
  const quests = dailyQuests();

  return h(Box, { flexDirection: 'column', padding: 1 },
    h(Header, { level, streak: state.streak, key: 'hd' }),
    h(Box, { gap: 2, key: 'row1' },
      h(Box, { flexGrow: 1, flexBasis: 0 }, h(LivePanel, { recent: state.recentEvents })),
      h(Box, { flexGrow: 1, flexBasis: 0 }, h(BossFight, { todayStats: state.todayStats })),
    ),
    h(Box, { marginTop: 1, key: 'row2' }, h(TodayRun, { todayStats: state.todayStats, level })),
    h(Box, { marginTop: 1, gap: 2, key: 'row3' },
      h(Box, { flexGrow: 1, flexBasis: 0 },
        h(Achievements, { unlocked: state.achievements, lastUnlocked: state.lastUnlocked })),
      h(Box, { flexGrow: 1, flexBasis: 0 },
        h(QuotaPanel, { todayStats: state.todayStats, quests })),
    ),
    h(Footer, { key: 'ft' }),
  );
}

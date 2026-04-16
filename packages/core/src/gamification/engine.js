// engine.js — gamification logic for TokenLens
// Philosophy: XP rewards GOOD HABITS (cache hits, cheap models, frugality).
// Never raw token volume — that would push users toward waste.

// ─── Level curve ────────────────────────────────────────────────────────────
// Quadratic growth: level 1 → 10 takes a week of regular use,
// level 10 → 20 takes about a month. Tuned by playtesting.
const XP_FOR_LEVEL = (n) => 500 + n * n * 200;

export function computeLevel(totalXp) {
  let level = 1;
  let accumulated = 0;
  while (accumulated + XP_FOR_LEVEL(level) <= totalXp) {
    accumulated += XP_FOR_LEVEL(level);
    level += 1;
  }
  const intoLevel = totalXp - accumulated;
  const needed = XP_FOR_LEVEL(level);
  return {
    level,
    intoLevel,
    needed,
    progress: intoLevel / needed,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
  };
}

const LEVEL_TITLES = [
  'Apprentice Prompter',   // 1
  'Junior Prompter',        // 2
  'Prompt Engineer',        // 3
  'Senior Prompt Engineer', // 4
  'Staff Prompt Engineer',  // 5
  'Principal Prompt Engineer', // 6
  'Distinguished Prompter', // 7
  'Token Whisperer',        // 8
  'Cache Samurai',          // 9
  'Prompt Sensei',          // 10
  'Context Maestro',        // 11
  'Compaction Virtuoso',    // 12
  'Legendary Prompter',     // 13+
];

// ─── XP rewards ─────────────────────────────────────────────────────────────
// Called when an event arrives. Returns XP for this event.
export function xpForEvent(event) {
  let xp = 0;

  // Base reward: 1 XP per 1k output tokens (small, just for activity)
  xp += Math.floor(event.outputTokens / 1000);

  // Cache bonus: +5 XP per 10k cache reads (reward cache-friendly patterns)
  xp += Math.floor(event.cacheReadTokens / 10000) * 5;

  // Cheap-model bonus: extra XP for using haiku/mini when it works
  if (event.model.includes('haiku') || event.model.includes('mini')) {
    xp += 10;
  }

  // Tool-use bonus: reward Edits and Bash (actual work) over pure reads
  if (event.toolName === 'Edit' || event.toolName === 'Write') xp += 5;
  if (event.toolName === 'Bash') xp += 3;

  return xp;
}

// ─── Achievements ───────────────────────────────────────────────────────────
// Checked on each new event. Returns array of newly-unlocked achievement IDs.
export const ACHIEVEMENTS = {
  first_session: {
    name: 'First Steps',
    desc: 'Logged your first session',
    icon: '◉',
  },
  cache_connoisseur: {
    name: 'Cache Connoisseur',
    desc: '90% cache-hit ratio in a single session',
    icon: '★',
  },
  night_owl: {
    name: 'Night Owl',
    desc: 'Coded between midnight and 5am on 5 different days',
    icon: '☾',
  },
  one_shot_wonder: {
    name: 'One-Shot Wonder',
    desc: 'Completed a session in under 10 minutes',
    icon: '⚡',
  },
  haiku_master: {
    name: 'Haiku Master',
    desc: 'Routed 50 tasks to Haiku',
    icon: '◇',
  },
  frugal_coder: {
    name: 'Frugal Coder',
    desc: 'Kept weekly spend under $20',
    icon: '◈',
  },
  refactor_king: {
    name: 'Refactor King',
    desc: '100 Edit tool calls in a single day',
    icon: '⚒',
  },
  streak_7: {
    name: 'Week Warrior',
    desc: '7-day coding streak',
    icon: '🔥',
  },
  streak_30: {
    name: 'Iron Habit',
    desc: '30-day coding streak',
    icon: '⚔',
  },
  polyglot: {
    name: 'Polyglot',
    desc: 'Used all three tools (Claude, Codex, Cursor) in one week',
    icon: '✦',
  },
};

export function checkAchievements(store, event, context = {}) {
  const unlocked = [];
  const already = new Set(store.achievements().map((a) => a.id));

  const tryUnlock = (id) => {
    if (already.has(id)) return;
    store.unlockAchievement(id);
    unlocked.push(id);
  };

  // First-session check is cheap
  if (store.recent(2).length <= 1) tryUnlock('first_session');

  // Night-owl check
  const hour = new Date(event.timestamp).getHours();
  if (hour >= 0 && hour < 5 && context.nightOwlDays >= 5) tryUnlock('night_owl');

  // Haiku master
  if (context.haikuCalls >= 50) tryUnlock('haiku_master');

  // Streak-based
  if (context.streakDays >= 7) tryUnlock('streak_7');
  if (context.streakDays >= 30) tryUnlock('streak_30');

  // Refactor king
  if (context.editsToday >= 100) tryUnlock('refactor_king');

  // Cache connoisseur — needs session-level aggregation
  if (context.sessionCacheRatio >= 0.9) tryUnlock('cache_connoisseur');

  return unlocked;
}

// ─── Daily quests ───────────────────────────────────────────────────────────
// Refresh at local midnight. Deterministic per-day so the same day shows
// the same quests on reload (seeded by YYYY-MM-DD).
const QUEST_POOL = [
  { id: 'early_bird', name: 'Log a session before 9am', xp: 200 },
  { id: 'three_tools', name: 'Use 3 different tools', xp: 150 },
  { id: 'cache_85', name: 'Hit 85%+ cache ratio', xp: 300 },
  { id: 'under_dollar', name: 'Keep a session under $1', xp: 400 },
  { id: 'commit_today', name: 'Commit code generated today', xp: 500 },
  { id: 'haiku_pick', name: 'Use Haiku for 5 tool calls', xp: 250 },
  { id: 'short_session', name: 'Finish a session under 15 min', xp: 200 },
  { id: 'no_opus', name: 'A full day without Opus', xp: 350 },
];

export function dailyQuests(date = new Date()) {
  const seed = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const hash = [...seed].reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0);
  const shuffled = [...QUEST_POOL].sort((a, b) => {
    const ha = (hash ^ a.id.charCodeAt(0)) & 0xffff;
    const hb = (hash ^ b.id.charCodeAt(0)) & 0xffff;
    return ha - hb;
  });
  return shuffled.slice(0, 4);
}

// ─── Streak calculation ─────────────────────────────────────────────────────
export function computeStreak(store) {
  const now = new Date();
  const today = startOfDay(now).getTime();
  let streak = 0;
  let cursor = today;

  while (true) {
    const next = cursor - 24 * 60 * 60 * 1000;
    const events = store.since(next).filter((e) => e.timestamp < cursor);
    if (events.length === 0 && cursor !== today) break;
    if (events.length === 0 && cursor === today) {
      cursor = next;
      continue; // today might be empty if user just started
    }
    streak += 1;
    cursor = next;
    if (streak > 365) break; // safety
  }
  return streak;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

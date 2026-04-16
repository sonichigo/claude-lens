// pricing.js — per-million-token prices in USD
// Refreshed from LiteLLM dataset. Substring matching so variants match.
export const pricing = {
  // Anthropic — April 2026 prices
  'claude-opus-4-6': { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-opus-4-5': { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },

  // OpenAI — April 2026 prices
  'gpt-5-codex': { input: 2.50, output: 10.00, cacheRead: 0.25, cacheWrite: 0 },
  'gpt-5': { input: 2.50, output: 10.00, cacheRead: 0.25, cacheWrite: 0 },
  'gpt-5-mini': { input: 0.25, output: 2.00, cacheRead: 0.025, cacheWrite: 0 },
};

const FALLBACK = { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 };

/**
 * Find the best pricing match via substring lookup.
 * E.g. "claude-sonnet-4-6-20260301" → "claude-sonnet-4-6"
 */
export function resolvePricing(model) {
  if (!model) return FALLBACK;
  const m = model.toLowerCase();

  // exact match first
  if (pricing[m]) return pricing[m];

  // substring match — longest key wins
  const keys = Object.keys(pricing).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (m.includes(key)) return pricing[key];
  }
  return FALLBACK;
}

export function calculateCost(model, tokens) {
  const p = resolvePricing(model);
  const input = (tokens.input || 0) * p.input / 1_000_000;
  const output = (tokens.output || 0) * p.output / 1_000_000;
  const cacheRead = (tokens.cacheRead || 0) * p.cacheRead / 1_000_000;
  const cacheWrite = (tokens.cacheWrite || 0) * p.cacheWrite / 1_000_000;
  return input + output + cacheRead + cacheWrite;
}

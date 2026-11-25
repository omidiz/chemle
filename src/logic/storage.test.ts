import { describe, expect, it } from 'vitest';
import { emptyStats, recordResult } from './stats';
import {
  loadProgress,
  loadStats,
  PROGRESS_KEY,
  saveProgress,
  saveStats,
  STATS_KEY,
  type KeyValueStore,
} from './storage';

function fakeStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const broken: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('progress', () => {
  it('round-trips', () => {
    const store = fakeStore();
    const p = { puzzle: 3, targetId: 'caffeine', guesses: ['dopamine', 'urea'] };
    saveProgress(store, p);
    expect(loadProgress(store)).toEqual(p);
  });

  it('returns null when missing, corrupt or malformed', () => {
    expect(loadProgress(fakeStore())).toBeNull();
    expect(loadProgress(fakeStore({ [PROGRESS_KEY]: '{not json' }))).toBeNull();
    expect(loadProgress(fakeStore({ [PROGRESS_KEY]: '{"puzzle":-1,"targetId":"x","guesses":[]}' }))).toBeNull();
    expect(loadProgress(fakeStore({ [PROGRESS_KEY]: '{"puzzle":1,"targetId":"x","guesses":[1]}' }))).toBeNull();
    expect(loadProgress(fakeStore({ [PROGRESS_KEY]: 'null' }))).toBeNull();
  });
});

describe('stats', () => {
  it('round-trips', () => {
    const store = fakeStore();
    const s = recordResult(emptyStats(), 0, true, 2);
    saveStats(store, s);
    expect(loadStats(store)).toEqual(s);
  });

  it('falls back to empty stats when missing or malformed', () => {
    expect(loadStats(fakeStore())).toEqual(emptyStats());
    expect(loadStats(fakeStore({ [STATS_KEY]: '[]' }))).toEqual(emptyStats());
    const bad = { ...emptyStats(), distribution: [1, 2] };
    expect(loadStats(fakeStore({ [STATS_KEY]: JSON.stringify(bad) }))).toEqual(emptyStats());
  });
});

it('survives storage that throws', () => {
  expect(loadProgress(broken)).toBeNull();
  expect(loadStats(broken)).toEqual(emptyStats());
  expect(() => saveProgress(broken, { puzzle: 0, targetId: 'x', guesses: [] })).not.toThrow();
  expect(() => saveStats(broken, emptyStats())).not.toThrow();
});

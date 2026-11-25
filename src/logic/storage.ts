import { MAX_GUESSES } from './game';
import { emptyStats, type Stats } from './stats';

/** The part of `localStorage` we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESS_KEY = 'chemle:progress';
export const STATS_KEY = 'chemle:stats';

/** Today's game in progress (or just finished), so a reload can restore it. */
export interface SavedProgress {
  puzzle: number;
  targetId: string;
  guesses: string[];
}

const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isIntOrNull = (v: unknown): v is number | null => v === null || isInt(v);

function read(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null; // Corrupt JSON or storage blocked (e.g. some private modes).
  }
}

function write(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game still works, it just won't persist.
  }
}

export function loadProgress(store: KeyValueStore): SavedProgress | null {
  const v = read(store, PROGRESS_KEY) as Partial<SavedProgress> | null;
  if (!v || typeof v !== 'object') return null;
  if (!isInt(v.puzzle) || typeof v.targetId !== 'string') return null;
  if (!Array.isArray(v.guesses) || !v.guesses.every((g) => typeof g === 'string')) return null;
  return { puzzle: v.puzzle, targetId: v.targetId, guesses: v.guesses };
}

export function saveProgress(store: KeyValueStore, progress: SavedProgress): void {
  write(store, PROGRESS_KEY, progress);
}

/** Saved stats, or empty stats if missing or malformed. */
export function loadStats(store: KeyValueStore): Stats {
  const v = read(store, STATS_KEY) as Partial<Stats> | null;
  if (!v || typeof v !== 'object') return emptyStats();
  const ok =
    isInt(v.played) &&
    isInt(v.wins) &&
    isInt(v.streak) &&
    isInt(v.maxStreak) &&
    Array.isArray(v.distribution) &&
    v.distribution.length === MAX_GUESSES &&
    v.distribution.every(isInt) &&
    isIntOrNull(v.lastPuzzle) &&
    isIntOrNull(v.lastWonPuzzle);
  if (!ok) return emptyStats();
  return {
    played: v.played!,
    wins: v.wins!,
    streak: v.streak!,
    maxStreak: v.maxStreak!,
    distribution: [...v.distribution!],
    lastPuzzle: v.lastPuzzle!,
    lastWonPuzzle: v.lastWonPuzzle!,
  };
}

export function saveStats(store: KeyValueStore, stats: Stats): void {
  write(store, STATS_KEY, stats);
}

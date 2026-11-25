import { LAUNCH_DATE, SHUFFLE_SEED } from '../config';
import type { Molecule } from './molecule';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days since 1970-01-01 for a calendar date. Going through Date.UTC
 * keeps every day exactly 24 h long, so DST changes can't shift the count.
 */
function dayNumber(year: number, monthIndex: number, day: number): number {
  return Math.round(Date.UTC(year, monthIndex, day) / DAY_MS);
}

/** Day number of `date` as shown on the player's own clock (local time). */
export function localDayNumber(date: Date): number {
  return dayNumber(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Day number of a 'YYYY-MM-DD' string. Throws on anything else. */
export function isoDayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad date: ${iso}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const check = new Date(Date.UTC(y, mo, d));
  if (check.getUTCMonth() !== mo || check.getUTCDate() !== d) throw new Error(`Bad date: ${iso}`);
  return dayNumber(y, mo, d);
}

/**
 * Today's puzzle number: local calendar days since the launch date
 * (launch day is #0). Clocks set before launch still get puzzle #0.
 */
export function puzzleNumber(now: Date, launchDate: string = LAUNCH_DATE): number {
  return Math.max(0, localDayNumber(now) - isoDayNumber(launchDate));
}

/** Small seeded PRNG (mulberry32): same seed → same sequence everywhere. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by `seededRandom(seed)`. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Molecule order for one pass through the list. Molecules are sorted by id
 * first so the order doesn't depend on how molecules.json is arranged. Each
 * pass ("cycle") gets its own shuffle, and a cycle never starts with the
 * molecule that ended the previous one (no repeat on consecutive days).
 */
export function cycleOrder<T extends { id: string }>(
  items: readonly T[],
  cycle: number,
  seed: number = SHUFFLE_SEED,
): T[] {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = seededShuffle(sorted, (seed + Math.imul(cycle, 0x9e3779b9)) >>> 0);
  if (cycle > 0 && order.length > 1) {
    const prev = seededShuffle(sorted, (seed + Math.imul(cycle - 1, 0x9e3779b9)) >>> 0);
    if (order[0]!.id === prev[prev.length - 1]!.id) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

/** The molecule for puzzle `n`. Every molecule appears once per cycle. */
export function moleculeForPuzzle(
  molecules: readonly Molecule[],
  n: number,
  seed: number = SHUFFLE_SEED,
): Molecule {
  if (molecules.length === 0) throw new Error('No molecules in data');
  if (!Number.isInteger(n) || n < 0) throw new Error(`Bad puzzle number: ${n}`);
  const cycle = Math.floor(n / molecules.length);
  return cycleOrder(molecules, cycle, seed)[n % molecules.length]!;
}

/** Milliseconds until the next local midnight, when the next puzzle starts. */
export function msUntilNextPuzzle(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** "HH:MM:SS" for a duration, rounded up to whole seconds, never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH_DATE } from '../config';
import {
  cycleOrder,
  formatCountdown,
  isoDayNumber,
  localDayNumber,
  moleculeForPuzzle,
  msUntilNextPuzzle,
  puzzleNumber,
  seededShuffle,
} from './daily';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const LAUNCH = '2026-11-25';

/** A local wall-clock time (month is 1-based for readability). */
const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  new Date(y, mo - 1, d, h, mi, s, ms);

/** Run as if the player's device were in time zone `tz` (Node reads TZ live). */
const inZone = (tz: string) => vi.stubEnv('TZ', tz);
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config', () => {
  it('has a valid launch date', () => {
    expect(() => isoDayNumber(LAUNCH_DATE)).not.toThrow();
  });
});

describe('isoDayNumber', () => {
  it('counts days and rejects malformed or impossible dates', () => {
    expect(isoDayNumber('1970-01-02')).toBe(1);
    expect(isoDayNumber('2024-03-01') - isoDayNumber('2024-02-28')).toBe(2); // leap year
    for (const bad of ['2026-11-5', '2026/11/25', '2026-02-30', '2026-13-01', '']) {
      expect(() => isoDayNumber(bad)).toThrow();
    }
  });
});

describe('puzzleNumber', () => {
  it('is 0 on launch day and counts up one per day', () => {
    expect(puzzleNumber(local(2026, 11, 25, 12), LAUNCH)).toBe(0);
    expect(puzzleNumber(local(2026, 11, 26, 12), LAUNCH)).toBe(1);
    expect(puzzleNumber(local(2026, 12, 25, 12), LAUNCH)).toBe(30);
    expect(puzzleNumber(local(2027, 11, 25, 12), LAUNCH)).toBe(365);
  });

  it('changes exactly at local midnight', () => {
    expect(puzzleNumber(local(2026, 11, 25, 0, 0, 0, 0), LAUNCH)).toBe(0);
    expect(puzzleNumber(local(2026, 11, 25, 23, 59, 59, 999), LAUNCH)).toBe(0);
    expect(puzzleNumber(local(2026, 11, 26, 0, 0, 0, 0), LAUNCH)).toBe(1);
  });

  it('handles month and year boundaries and leap days', () => {
    expect(puzzleNumber(local(2026, 11, 30, 23, 59, 59, 999), LAUNCH)).toBe(5);
    expect(puzzleNumber(local(2026, 12, 1), LAUNCH)).toBe(6);
    expect(puzzleNumber(local(2026, 12, 31, 23, 59, 59, 999), LAUNCH)).toBe(36);
    expect(puzzleNumber(local(2027, 1, 1), LAUNCH)).toBe(37);
    expect(puzzleNumber(local(2028, 2, 29), LAUNCH) + 1).toBe(puzzleNumber(local(2028, 3, 1), LAUNCH));
  });

  it('gives puzzle 0 to clocks set before launch', () => {
    expect(puzzleNumber(local(2026, 11, 24, 23, 59, 59, 999), LAUNCH)).toBe(0);
    expect(puzzleNumber(local(2020, 1, 1), LAUNCH)).toBe(0);
  });

  it('uses the local date, not UTC', () => {
    inZone('America/Los_Angeles');
    // 2026-11-26 07:30 UTC is still the 25th in Los Angeles…
    expect(puzzleNumber(new Date('2026-11-26T07:30:00Z'), LAUNCH)).toBe(0);
    // …and already the 26th once it's 08:00 UTC (midnight PST).
    expect(puzzleNumber(new Date('2026-11-26T08:00:00Z'), LAUNCH)).toBe(1);

    inZone('Asia/Tokyo');
    // 2026-11-25 15:00 UTC is midnight of the 26th in Tokyo.
    expect(puzzleNumber(new Date('2026-11-25T14:59:59.999Z'), LAUNCH)).toBe(0);
    expect(puzzleNumber(new Date('2026-11-25T15:00:00Z'), LAUNCH)).toBe(1);
  });

  it('is not thrown off by DST days (23 h or 25 h long)', () => {
    inZone('Europe/Berlin');
    // Spring forward: 2027-03-28 is 23 h long.
    const spring = puzzleNumber(local(2027, 3, 28, 0, 0), LAUNCH);
    expect(puzzleNumber(local(2027, 3, 27, 23, 59, 59, 999), LAUNCH)).toBe(spring - 1);
    expect(puzzleNumber(local(2027, 3, 28, 23, 59, 59, 999), LAUNCH)).toBe(spring);
    expect(puzzleNumber(local(2027, 3, 29, 0, 0), LAUNCH)).toBe(spring + 1);
    // Fall back: 2027-10-31 is 25 h long.
    const fall = puzzleNumber(local(2027, 10, 31, 0, 0), LAUNCH);
    expect(puzzleNumber(local(2027, 10, 31, 23, 59, 59, 999), LAUNCH)).toBe(fall);
    expect(puzzleNumber(local(2027, 11, 1, 0, 0), LAUNCH)).toBe(fall + 1);
    // Whole-year count is unaffected by both changes.
    expect(puzzleNumber(local(2027, 11, 25, 12), LAUNCH)).toBe(365);
  });

  it('copes with a zone whose midnight is skipped by DST', () => {
    inZone('America/Santiago');
    // Clocks jump 00:00 → 01:00 on 2026-09-06; the first instant is 01:00.
    const day = localDayNumber(new Date('2026-09-06T04:00:00Z'));
    expect(localDayNumber(new Date('2026-09-06T03:59:59.999Z'))).toBe(day - 1);
    expect(day).toBe(isoDayNumber('2026-09-06'));
  });
});

describe('msUntilNextPuzzle / formatCountdown', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextPuzzle(local(2026, 11, 25, 23, 59, 59, 0))).toBe(1000);
    expect(msUntilNextPuzzle(local(2026, 11, 25, 0, 0))).toBe(24 * 3600 * 1000);
    expect(msUntilNextPuzzle(local(2026, 12, 31, 23, 0))).toBe(3600 * 1000);
  });

  it('accounts for short and long DST days', () => {
    inZone('Europe/Berlin');
    expect(msUntilNextPuzzle(local(2027, 3, 28, 0, 0))).toBe(23 * 3600 * 1000);
    expect(msUntilNextPuzzle(local(2027, 10, 31, 0, 0))).toBe(25 * 3600 * 1000);
  });

  it('formats as HH:MM:SS, rounding up and never negative', () => {
    expect(formatCountdown(24 * 3600 * 1000)).toBe('24:00:00');
    expect(formatCountdown((3 * 3600 + 4 * 60 + 5) * 1000)).toBe('03:04:05');
    expect(formatCountdown(1)).toBe('00:00:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });
});

describe('molecule order', () => {
  it('shuffles deterministically', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
    expect(seededShuffle(items, 42)).not.toEqual(seededShuffle(items, 43));
    expect([...seededShuffle(items, 42)].sort((a, b) => a - b)).toEqual(items);
  });

  it('is not alphabetical and not the file order', () => {
    const ids = cycleOrder(molecules, 0).map((m) => m.id);
    expect(ids).not.toEqual([...ids].sort());
    expect(ids).not.toEqual(molecules.map((m) => m.id));
  });

  it('does not depend on the order of molecules.json', () => {
    const reversed = [...molecules].reverse();
    for (let n = 0; n < 100; n++) {
      expect(moleculeForPuzzle(reversed, n).id).toBe(moleculeForPuzzle(molecules, n).id);
    }
  });

  it('uses every molecule once per cycle, then reshuffles', () => {
    const len = molecules.length;
    const cycle = (c: number) =>
      Array.from({ length: len }, (_, i) => moleculeForPuzzle(molecules, c * len + i).id);
    for (const c of [0, 1, 2]) expect(new Set(cycle(c)).size).toBe(len);
    expect(cycle(1)).not.toEqual(cycle(0));
  });

  it('never repeats a molecule on consecutive days', () => {
    for (let n = 1; n < molecules.length * 50; n++) {
      expect(moleculeForPuzzle(molecules, n).id).not.toBe(moleculeForPuzzle(molecules, n - 1).id);
    }
  });

  it('rejects bad input', () => {
    expect(() => moleculeForPuzzle([], 0)).toThrow();
    expect(() => moleculeForPuzzle(molecules, -1)).toThrow();
    expect(() => moleculeForPuzzle(molecules, 1.5)).toThrow();
  });
});

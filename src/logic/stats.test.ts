import { describe, expect, it } from 'vitest';
import { currentStreak, emptyStats, recordResult, winPercent, type Stats } from './stats';

function play(results: [puzzle: number, won: boolean, guesses: number][]): Stats {
  return results.reduce((s, [p, w, g]) => recordResult(s, p, w, g), emptyStats());
}

describe('recordResult', () => {
  it('counts games, wins and the guess distribution', () => {
    const s = play([
      [0, true, 3],
      [1, false, 6],
      [2, true, 1],
      [3, true, 3],
    ]);
    expect(s).toMatchObject({ played: 4, wins: 3, distribution: [1, 0, 2, 0, 0, 0] });
    expect(winPercent(s)).toBe(75);
  });

  it('builds streaks on consecutive wins and resets on a loss', () => {
    const s = play([
      [0, true, 2],
      [1, true, 2],
      [2, true, 2],
      [3, false, 6],
      [4, true, 4],
    ]);
    expect(s).toMatchObject({ streak: 1, maxStreak: 3 });
  });

  it('restarts the streak after a skipped day', () => {
    const s = play([
      [0, true, 2],
      [1, true, 2],
      [3, true, 2],
    ]);
    expect(s).toMatchObject({ streak: 1, maxStreak: 2 });
  });

  it('ignores a puzzle that was already recorded', () => {
    const once = play([[5, true, 2]]);
    expect(recordResult(once, 5, true, 2)).toBe(once);
    expect(recordResult(once, 4, false, 6)).toBe(once);
  });
});

describe('currentStreak', () => {
  const s = play([
    [0, true, 2],
    [1, true, 2],
  ]);
  it('holds until the next puzzle is missed', () => {
    expect(currentStreak(s, 1)).toBe(2);
    expect(currentStreak(s, 2)).toBe(2); // today not played yet
    expect(currentStreak(s, 3)).toBe(0); // missed puzzle 2
  });
  it('is 0 with no wins', () => {
    expect(currentStreak(emptyStats(), 0)).toBe(0);
  });
});

describe('winPercent', () => {
  it('is 0 before any game and rounds', () => {
    expect(winPercent(emptyStats())).toBe(0);
    expect(winPercent(play([[0, true, 1], [1, true, 1], [2, false, 6]]))).toBe(67);
  });
});

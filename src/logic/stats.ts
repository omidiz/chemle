import { MAX_GUESSES } from './game';

export interface Stats {
  played: number;
  wins: number;
  /** Streak as of `lastWonPuzzle`; see `currentStreak` for today's value. */
  streak: number;
  maxStreak: number;
  /** Wins by number of guesses: index 0 = solved in 1, … index 5 = in 6. */
  distribution: number[];
  /** Last puzzle whose result was recorded (guards against double counting). */
  lastPuzzle: number | null;
  lastWonPuzzle: number | null;
}

export function emptyStats(): Stats {
  return {
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
    distribution: Array<number>(MAX_GUESSES).fill(0),
    lastPuzzle: null,
    lastWonPuzzle: null,
  };
}

/**
 * Add a finished game. A streak continues only if the previous puzzle was
 * won too. Recording the same (or an older) puzzle again changes nothing.
 */
export function recordResult(stats: Stats, puzzle: number, won: boolean, guesses: number): Stats {
  if (stats.lastPuzzle !== null && puzzle <= stats.lastPuzzle) return stats;
  const distribution = [...stats.distribution];
  let streak = 0;
  if (won) {
    const slot = Math.min(Math.max(guesses, 1), MAX_GUESSES) - 1;
    distribution[slot] = (distribution[slot] ?? 0) + 1;
    streak = stats.lastWonPuzzle === puzzle - 1 ? stats.streak + 1 : 1;
  }
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    distribution,
    lastPuzzle: puzzle,
    lastWonPuzzle: won ? puzzle : stats.lastWonPuzzle,
  };
}

/** Streak to show on puzzle `today`: it breaks once a whole day is skipped. */
export function currentStreak(stats: Stats, today: number): number {
  return stats.lastWonPuzzle !== null && stats.lastWonPuzzle >= today - 1 ? stats.streak : 0;
}

/** Win percentage, rounded to a whole number (0 when nothing played). */
export function winPercent(stats: Stats): number {
  return stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100);
}

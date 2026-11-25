import { compareMolecules, comparisonTiles, type Verdict } from './compare';
import { MAX_GUESSES, type GameState } from './game';
import type { Molecule } from './molecule';

/** Shown at the end of the shared text (no scheme, so it stays short). */
export const SHARE_URL = 'omidiz.github.io/chemle';

export function verdictEmoji(v: Verdict): string {
  switch (v) {
    case 'match':
      return '🟩';
    case 'close':
      return '🟨';
    case 'miss':
      return '⬜';
  }
}

/**
 * Spoiler-free result text: a header, one emoji row per guess (one emoji per
 * tile, in tile order; the correct guess is all green), then the URL.
 * Only verdict colors are included: no names, values or groups.
 */
export function shareText(
  state: GameState,
  byId: ReadonlyMap<string, Molecule>,
  puzzle: number,
): string {
  const target = byId.get(state.targetId);
  if (!target) throw new Error(`Unknown target ${state.targetId}`);
  const score = state.status === 'won' ? String(state.guesses.length) : 'X';
  const rows = state.guesses.map((id) => {
    const guess = byId.get(id);
    if (!guess) throw new Error(`Unknown guess ${id}`);
    return comparisonTiles(compareMolecules(guess, target))
      .map((t) => verdictEmoji(t.verdict))
      .join('');
  });
  return [`Chemle #${puzzle} ${score}/${MAX_GUESSES}`, ...rows, SHARE_URL].join('\n');
}

import { compareMolecules, comparisonTiles, tileDescription } from './compare';
import { guessesLeft, type GameState } from './game';
import type { Molecule } from './molecule';

/**
 * What a screen reader should hear after the latest guess: whether it was
 * right, the comparison tiles as sentences, guesses left and any hints that
 * were just revealed. Never names the answer while the game is still on.
 */
export function guessAnnouncement(
  state: GameState,
  byId: ReadonlyMap<string, Molecule>,
  newHints: readonly string[],
  firstNewHint: number,
): string {
  const lastId = state.guesses[state.guesses.length - 1];
  const guess = lastId === undefined ? undefined : byId.get(lastId);
  const target = byId.get(state.targetId);
  if (!guess || !target) return '';
  if (state.status === 'won') return `${guess.name} is correct!`;

  const parts = [`${guess.name}: wrong.`];
  parts.push(...comparisonTiles(compareMolecules(guess, target)).map((t) => `${tileDescription(t)}.`));
  if (state.status === 'lost') {
    parts.push(`Out of guesses. The answer was ${target.name}.`);
  } else {
    const left = guessesLeft(state);
    parts.push(`${left} guess${left === 1 ? '' : 'es'} left.`);
  }
  newHints.forEach((h, i) => parts.push(`Hint ${firstNewHint + i + 1}: ${h}`));
  return parts.join(' ');
}

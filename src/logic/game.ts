import { findMolecule } from './match';
import type { Molecule } from './molecule';

export const MAX_GUESSES = 6;

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  targetId: string;
  /** Ids of guessed molecules, in order. */
  guesses: string[];
  status: GameStatus;
}

export type GuessError = 'empty' | 'unknown' | 'duplicate' | 'over';

export type GuessResult =
  | { ok: true; state: GameState; molecule: Molecule }
  | { ok: false; error: GuessError };

export function newGame(target: Molecule): GameState {
  return { targetId: target.id, guesses: [], status: 'playing' };
}

/**
 * Rebuild a game from saved guess ids (e.g. after a reload). Unknown or
 * repeated ids are dropped, and replay stops once the game is over.
 */
export function restoreGame(
  target: Molecule,
  savedGuesses: readonly string[],
  molecules: readonly Molecule[],
): GameState {
  const known = new Set(molecules.map((m) => m.id));
  let state = newGame(target);
  for (const id of savedGuesses) {
    if (state.status !== 'playing') break;
    if (!known.has(id) || state.guesses.includes(id)) continue;
    state = addGuess(state, id);
  }
  return state;
}

/** Apply a typed guess. Only names/aliases from `molecules` are accepted. */
export function submitGuess(
  state: GameState,
  input: string,
  molecules: readonly Molecule[],
): GuessResult {
  if (state.status !== 'playing') return { ok: false, error: 'over' };
  if (!input.trim()) return { ok: false, error: 'empty' };
  const molecule = findMolecule(molecules, input);
  if (!molecule) return { ok: false, error: 'unknown' };
  if (state.guesses.includes(molecule.id)) return { ok: false, error: 'duplicate' };

  return { ok: true, state: addGuess(state, molecule.id), molecule };
}

function addGuess(state: GameState, id: string): GameState {
  const guesses = [...state.guesses, id];
  const status: GameStatus =
    id === state.targetId ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { ...state, guesses, status };
}

export function guessesLeft(state: GameState): number {
  return MAX_GUESSES - state.guesses.length;
}

export function wrongGuessCount(state: GameState): number {
  return state.guesses.filter((id) => id !== state.targetId).length;
}

export function errorMessage(error: GuessError): string {
  switch (error) {
    case 'empty':
      return 'Type a molecule name.';
    case 'unknown':
      return 'Not in the molecule list — pick one from the suggestions.';
    case 'duplicate':
      return 'You already guessed that one.';
    case 'over':
      return 'The game is over.';
  }
}

/** Split a formula like "C8H10N4O2" into text/subscript runs for display. */
export function formulaParts(formula: string): { text: string; sub: boolean }[] {
  return [...formula.matchAll(/(\d+)|(\D+)/g)].map((m) => ({ text: m[0], sub: !!m[1] }));
}

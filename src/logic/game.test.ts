import { describe, expect, it } from 'vitest';
import {
  formulaParts,
  guessesLeft,
  MAX_GUESSES,
  newGame,
  submitGuess,
  wrongGuessCount,
  type GameState,
} from './game';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const target = molecules.find((m) => m.id === 'caffeine')!;
const wrong = molecules.filter((m) => m.id !== target.id);

function play(state: GameState, input: string): GameState {
  const r = submitGuess(state, input, molecules);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('submitGuess', () => {
  it('wins on the correct name or an alias', () => {
    expect(play(newGame(target), 'caffeine').status).toBe('won');
    expect(play(newGame(target), '1,3,7-Trimethyl xanthine').status).toBe('won');
  });

  it('records wrong guesses and keeps playing', () => {
    const s = play(newGame(target), 'Dopamine');
    expect(s).toMatchObject({ guesses: ['dopamine'], status: 'playing' });
    expect(guessesLeft(s)).toBe(MAX_GUESSES - 1);
  });

  it('rejects unknown, empty and duplicate guesses without using a turn', () => {
    const s = play(newGame(target), 'dopamine');
    expect(submitGuess(s, 'water', molecules)).toEqual({ ok: false, error: 'unknown' });
    expect(submitGuess(s, '   ', molecules)).toEqual({ ok: false, error: 'empty' });
    expect(submitGuess(s, 'DOPAMINE', molecules)).toEqual({ ok: false, error: 'duplicate' });
    expect(s.guesses).toHaveLength(1);
  });

  it('treats an alias of an already guessed molecule as a duplicate', () => {
    const s = play(newGame(target), 'adrenaline');
    expect(submitGuess(s, 'epinephrine', molecules)).toEqual({ ok: false, error: 'duplicate' });
  });

  it('loses after 6 wrong guesses and then refuses more', () => {
    let s = newGame(target);
    for (let i = 0; i < MAX_GUESSES; i++) {
      expect(s.status).toBe('playing');
      s = play(s, wrong[i]!.name);
    }
    expect(s.status).toBe('lost');
    expect(guessesLeft(s)).toBe(0);
    expect(submitGuess(s, 'caffeine', molecules)).toEqual({ ok: false, error: 'over' });
  });

  it('can win on the last guess', () => {
    let s = newGame(target);
    for (let i = 0; i < MAX_GUESSES - 1; i++) s = play(s, wrong[i]!.name);
    expect(play(s, 'Caffeine').status).toBe('won');
  });
});

describe('wrongGuessCount', () => {
  it('counts only wrong guesses', () => {
    let s = newGame(target);
    expect(wrongGuessCount(s)).toBe(0);
    s = play(s, 'dopamine');
    s = play(s, 'aspirin');
    expect(wrongGuessCount(s)).toBe(2);
    s = play(s, 'caffeine');
    expect(wrongGuessCount(s)).toBe(2);
  });
});

describe('formulaParts', () => {
  it('marks digits as subscripts', () => {
    expect(formulaParts('C8H10N4O2')).toEqual([
      { text: 'C', sub: false }, { text: '8', sub: true },
      { text: 'H', sub: false }, { text: '10', sub: true },
      { text: 'N', sub: false }, { text: '4', sub: true },
      { text: 'O', sub: false }, { text: '2', sub: true },
    ]);
  });
});

describe('molecule data', () => {
  it('has a one-line fact for every molecule', () => {
    for (const m of molecules) {
      expect(m.fact, m.id).toMatch(/\S/);
      expect(m.fact, m.id).not.toContain('\n');
    }
  });
});

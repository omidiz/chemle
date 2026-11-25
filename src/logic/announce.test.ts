import { describe, expect, it } from 'vitest';
import { guessAnnouncement } from './announce';
import { newGame, submitGuess } from './game';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const byId = new Map(molecules.map((m) => [m.id, m]));
const target = byId.get('caffeine')!;

function play(...names: string[]) {
  let state = newGame(target);
  for (const n of names) {
    const r = submitGuess(state, n, molecules);
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  }
  return state;
}

describe('guessAnnouncement', () => {
  it('describes a wrong guess without naming the answer', () => {
    const text = guessAnnouncement(play('urea'), byId, [], 0);
    expect(text).toMatch(/^Urea: wrong\. Molecular weight 60\.1: no match, target is higher\./);
    expect(text).toContain('5 guesses left.');
    expect(text.toLowerCase()).not.toContain('caffeine');
  });

  it('reads newly revealed hints with their number', () => {
    const text = guessAnnouncement(play('urea', 'glycine', 'ethanol'), byId, ['Bitter.'], 0);
    expect(text).toMatch(/3 guesses left\. Hint 1: Bitter\.$/);
  });

  it('says when the guess is correct', () => {
    expect(guessAnnouncement(play('urea', 'caffeine'), byId, [], 0)).toBe('Caffeine is correct!');
  });

  it('reveals the answer only once the game is lost', () => {
    const state = play('urea', 'glycine', 'ethanol', 'aspirin', 'gaba', 'atp');
    expect(state.status).toBe('lost');
    expect(guessAnnouncement(state, byId, [], 0)).toContain('Out of guesses. The answer was Caffeine.');
  });

  it('is empty before any guess', () => {
    expect(guessAnnouncement(newGame(target), byId, [], 0)).toBe('');
  });
});

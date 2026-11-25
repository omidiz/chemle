import { describe, expect, it } from 'vitest';
import { compareMolecules, comparisonTiles } from './compare';
import type { GameState } from './game';
import type { Molecule } from './molecule';
import { SHARE_URL, shareText, verdictEmoji } from './share';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const byId = new Map(molecules.map((m) => [m.id, m]));
const state = (targetId: string, guesses: string[], status: GameState['status']): GameState => ({
  targetId,
  guesses,
  status,
});

describe('shareText', () => {
  it('has a header, one row per guess and the URL', () => {
    const s = state('caffeine', ['dopamine', 'theobromine', 'caffeine'], 'won');
    const lines = shareText(s, byId, 12).split('\n');
    expect(lines[0]).toBe('Chemle #12 3/6');
    expect(lines).toHaveLength(5);
    expect(lines[3]).toBe('🟩🟩🟩🟩🟩');
    expect(lines[4]).toBe(SHARE_URL);
  });

  it('uses one emoji per tile, in tile order', () => {
    const s = state('caffeine', ['dopamine', 'caffeine'], 'won');
    const expected = comparisonTiles(compareMolecules(byId.get('dopamine')!, byId.get('caffeine')!))
      .map((t) => verdictEmoji(t.verdict))
      .join('');
    expect(shareText(s, byId, 1).split('\n')[1]).toBe(expected);
    expect([...expected]).toHaveLength(5);
  });

  it('scores a loss as X/6', () => {
    const guesses = ['dopamine', 'ethanol', 'urea', 'glucose', 'aspirin', 'menthol'];
    const text = shareText(state('caffeine', guesses, 'lost'), byId, 3);
    expect(text.startsWith('Chemle #3 X/6\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(8);
  });

  it('never reveals the answer or any guess', () => {
    for (const target of molecules) {
      const s = state(target.id, ['caffeine', 'ethanol', target.id], 'won');
      const text = shareText(s, byId, 7).toLowerCase();
      const body = text.replace(SHARE_URL, '');
      for (const word of [target.name, target.id, ...target.aliases, 'caffeine', 'ethanol']) {
        expect(body).not.toContain(word.toLowerCase());
      }
      // Only the header, emoji squares, digits and the URL.
      expect(body).toMatch(/^chemle #\d+ [\dx]\/6\n([🟩🟨⬜]{5}\n)+$/u);
    }
  });
});

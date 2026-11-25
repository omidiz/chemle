import { describe, expect, it } from 'vitest';
import {
  compareCategory,
  compareGroups,
  compareHeavyAtoms,
  compareMolecules,
  compareRings,
  compareWeight,
  comparisonTiles,
  direction,
  directionArrow,
  tileDescription,
  tileValue,
  verdictIcon,
  type Verdict,
} from './compare';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const mol = (id: string) => molecules.find((m) => m.id === id)!;

describe('direction', () => {
  it('points toward the target', () => {
    expect(direction(100, 150)).toBe('up');
    expect(direction(150, 100)).toBe('down');
    expect(direction(100, 100)).toBe('equal');
  });
});

describe('compareWeight', () => {
  it('is green when equal', () => {
    expect(compareWeight(180.16, 180.16)).toEqual({
      key: 'weight',
      verdict: 'match',
      direction: 'equal',
      value: 180.16,
    });
  });

  it('is green within 10% of the target, inclusive', () => {
    expect(compareWeight(110, 100).verdict).toBe('match');
    expect(compareWeight(90, 100).verdict).toBe('match');
    expect(compareWeight(105, 100).verdict).toBe('match');
  });

  it('is yellow between 10% and 30%, inclusive', () => {
    expect(compareWeight(110.01, 100).verdict).toBe('close');
    expect(compareWeight(89.99, 100).verdict).toBe('close');
    expect(compareWeight(130, 100).verdict).toBe('close');
    expect(compareWeight(70, 100).verdict).toBe('close');
  });

  it('is gray beyond 30%', () => {
    expect(compareWeight(130.01, 100).verdict).toBe('miss');
    expect(compareWeight(69.99, 100).verdict).toBe('miss');
    expect(compareWeight(46.07, 507.18).verdict).toBe('miss');
  });

  it('measures the percentage relative to the target', () => {
    // 100 is 20% below 125 (close), while 125 is 25% above 100 (also close)...
    expect(compareWeight(100, 125).verdict).toBe('close');
    // ...but 100 vs 111 is within 10% of 111, and 111 vs 100 is not within 10% of 100.
    expect(compareWeight(100, 111).verdict).toBe('match');
    expect(compareWeight(111, 100).verdict).toBe('close');
  });

  it('keeps the arrow even when green', () => {
    expect(compareWeight(95, 100)).toMatchObject({ verdict: 'match', direction: 'up' });
    expect(compareWeight(105, 100)).toMatchObject({ verdict: 'match', direction: 'down' });
  });

  it('does not divide by zero', () => {
    expect(compareWeight(0, 0).verdict).toBe('match');
    expect(compareWeight(5, 0).verdict).toBe('miss');
  });
});

describe('compareHeavyAtoms', () => {
  it('is green only when equal', () => {
    expect(compareHeavyAtoms(14, 14)).toEqual({
      key: 'heavyAtoms',
      verdict: 'match',
      direction: 'equal',
      value: 14,
    });
  });

  it('is yellow within 3 atoms either way', () => {
    for (const g of [11, 12, 13, 15, 16, 17]) {
      expect(compareHeavyAtoms(g, 14).verdict).toBe('close');
    }
  });

  it('is gray when 4 or more atoms off', () => {
    expect(compareHeavyAtoms(10, 14).verdict).toBe('miss');
    expect(compareHeavyAtoms(18, 14).verdict).toBe('miss');
  });

  it('has an arrow toward the target', () => {
    expect(compareHeavyAtoms(10, 14).direction).toBe('up');
    expect(compareHeavyAtoms(15, 14).direction).toBe('down');
  });
});

describe('compareRings', () => {
  it('is green when equal', () => {
    expect(compareRings(2, 2)).toEqual({
      key: 'rings',
      verdict: 'match',
      direction: 'equal',
      value: 2,
    });
  });

  it('is gray with an arrow otherwise (no yellow)', () => {
    expect(compareRings(1, 2)).toMatchObject({ verdict: 'miss', direction: 'up' });
    expect(compareRings(3, 2)).toMatchObject({ verdict: 'miss', direction: 'down' });
    expect(compareRings(0, 5)).toMatchObject({ verdict: 'miss', direction: 'up' });
  });
});

describe('compareGroups', () => {
  it('is green for an identical set, regardless of order', () => {
    expect(compareGroups(['amide', 'aromatic ring'], ['aromatic ring', 'amide'])).toEqual({
      key: 'groups',
      verdict: 'match',
      shared: ['amide', 'aromatic ring'],
    });
  });

  it('is yellow when some are shared, listing them in the guess order', () => {
    expect(compareGroups(['phenol', 'amine', 'aromatic ring'], ['amide', 'aromatic ring'])).toEqual(
      { key: 'groups', verdict: 'close', shared: ['aromatic ring'] },
    );
  });

  it('is yellow when the guess is a strict subset or superset', () => {
    expect(compareGroups(['alcohol'], ['alcohol', 'ketone']).verdict).toBe('close');
    expect(compareGroups(['alcohol', 'ketone'], ['alcohol']).verdict).toBe('close');
  });

  it('is gray when nothing is shared', () => {
    expect(compareGroups(['alcohol'], ['amide'])).toEqual({
      key: 'groups',
      verdict: 'miss',
      shared: [],
    });
  });

  it('handles empty sets', () => {
    expect(compareGroups([], []).verdict).toBe('match');
    expect(compareGroups([], ['alcohol']).verdict).toBe('miss');
    expect(compareGroups(['alcohol'], []).verdict).toBe('miss');
  });

  it('ignores duplicates', () => {
    expect(compareGroups(['amine', 'amine'], ['amine'])).toEqual({
      key: 'groups',
      verdict: 'match',
      shared: ['amine'],
    });
  });
});

describe('compareCategory', () => {
  it('is green only for the same category', () => {
    expect(compareCategory('food', 'food')).toEqual({
      key: 'category',
      verdict: 'match',
      value: 'food',
    });
    expect(compareCategory('drug', 'food')).toEqual({
      key: 'category',
      verdict: 'miss',
      value: 'drug',
    });
  });
});

describe('compareMolecules', () => {
  it('compares theobromine against caffeine', () => {
    const c = compareMolecules(mol('theobromine'), mol('caffeine'));
    expect(c.weight).toMatchObject({ verdict: 'match', direction: 'up', value: 180.16 });
    expect(c.heavyAtoms).toMatchObject({ verdict: 'close', direction: 'up', value: 13 });
    expect(c.rings).toMatchObject({ verdict: 'match', direction: 'equal' });
    expect(c.groups).toMatchObject({ verdict: 'match', shared: ['amide', 'aromatic ring'] });
    expect(c.category).toMatchObject({ verdict: 'match', value: 'food' });
  });

  it('compares ethanol against cholesterol', () => {
    const c = compareMolecules(mol('ethanol'), mol('cholesterol'));
    expect(c.weight).toMatchObject({ verdict: 'miss', direction: 'up' });
    expect(c.heavyAtoms).toMatchObject({ verdict: 'miss', direction: 'up' });
    expect(c.rings).toMatchObject({ verdict: 'miss', direction: 'up' });
    expect(c.groups).toMatchObject({ verdict: 'match', shared: ['alcohol'] });
    expect(c.category).toMatchObject({ verdict: 'miss', value: 'food' });
  });

  it('compares dopamine against caffeine', () => {
    const c = compareMolecules(mol('dopamine'), mol('caffeine'));
    expect(c.weight.verdict).toBe('close'); // 153.18 vs 194.19 ≈ 21% off
    expect(c.heavyAtoms).toMatchObject({ verdict: 'close', direction: 'up' }); // 11 vs 14
    expect(c.groups).toMatchObject({ verdict: 'close', shared: ['aromatic ring'] });
    expect(c.category.verdict).toBe('miss');
  });

  it('gives an all-green row for the target itself', () => {
    for (const m of molecules) {
      const tiles = comparisonTiles(compareMolecules(m, m));
      expect(tiles.map((t) => t.verdict)).toEqual(Array(5).fill('match'));
    }
  });

  it('never exposes target values, only the guess', () => {
    const c = compareMolecules(mol('aspirin'), mol('atp'));
    const json = JSON.stringify(c);
    expect(json).not.toContain('507');
    expect(json).not.toContain('metabolite');
  });
});

describe('comparisonTiles', () => {
  it('lists the five tiles in display order', () => {
    const c = compareMolecules(mol('aspirin'), mol('ibuprofen'));
    expect(comparisonTiles(c).map((t) => t.key)).toEqual([
      'weight',
      'heavyAtoms',
      'rings',
      'category',
      'groups',
    ]);
  });
});

describe('non-color cues', () => {
  it('gives each verdict a distinct icon', () => {
    const verdicts: Verdict[] = ['match', 'close', 'miss'];
    const icons = verdicts.map(verdictIcon);
    expect(new Set(icons).size).toBe(3);
    expect(icons.every((i) => i.length > 0)).toBe(true);
  });

  it('uses arrows for direction', () => {
    expect(directionArrow('up')).toBe('↑');
    expect(directionArrow('down')).toBe('↓');
    expect(directionArrow('equal')).toBe('');
  });

  it('formats tile values', () => {
    expect(tileValue(compareWeight(194.19, 100))).toBe('194.2');
    expect(tileValue(compareHeavyAtoms(14, 10))).toBe('14');
    expect(tileValue(compareCategory('drug', 'food'))).toBe('drug');
    expect(tileValue(compareGroups(['amine', 'phenol'], ['phenol', 'amine']))).toBe(
      'amine, phenol',
    );
    expect(tileValue(compareGroups(['amine'], ['phenol']))).toBe('none shared');
  });

  it('describes tiles in words for screen readers', () => {
    expect(tileDescription(compareWeight(153.18, 194.19))).toBe(
      'Molecular weight 153.2: close, target is higher',
    );
    expect(tileDescription(compareHeavyAtoms(14, 14))).toBe('Heavy atoms 14: match, exact');
    expect(tileDescription(compareRings(3, 1))).toBe('Rings 3: no match, target is lower');
    expect(tileDescription(compareCategory('drug', 'food'))).toBe('Category drug: no match');
    expect(tileDescription(compareGroups(['amine', 'phenol'], ['phenol']))).toBe(
      'Functional groups: close, shared phenol',
    );
    expect(tileDescription(compareGroups(['amine'], ['phenol']))).toBe(
      'Functional groups: no match, none shared',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { findMolecule, normalizeName, suggest } from './match';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];

function mol(id: string, name: string, aliases: string[] = []): Molecule {
  return {
    id, name, aliases, category: 'food', fact: '', formula: '', molecularWeight: 0,
    heavyAtoms: 0, rings: 0, aromaticRings: 0, functionalGroups: [],
  };
}

const sample = [
  mol('caffeine', 'Caffeine', ['guaranine']),
  mol('acetic-acid', 'Acetic acid', ['ethanoic acid']),
  mol('ethanol', 'Ethanol', ['ethyl alcohol', 'alcohol']),
  mol('gaba', 'GABA', ['gamma-aminobutyric acid']),
];

describe('normalizeName', () => {
  it('ignores case, spaces and hyphens', () => {
    expect(normalizeName('  Acetic-Acid ')).toBe('aceticacid');
    expect(normalizeName('Gamma - Amino butyric')).toBe('gammaaminobutyric');
  });
});

describe('findMolecule', () => {
  it('matches names and aliases loosely', () => {
    expect(findMolecule(sample, 'CAFFEINE')?.id).toBe('caffeine');
    expect(findMolecule(sample, 'acetic acid')?.id).toBe('acetic-acid');
    expect(findMolecule(sample, 'aceticacid')?.id).toBe('acetic-acid');
    expect(findMolecule(sample, 'Ethanoic-Acid')?.id).toBe('acetic-acid');
    expect(findMolecule(sample, 'gamma aminobutyric acid')?.id).toBe('gaba');
  });

  it('rejects unknown, partial or empty input', () => {
    expect(findMolecule(sample, 'water')).toBeUndefined();
    expect(findMolecule(sample, 'caff')).toBeUndefined();
    expect(findMolecule(sample, '  - ')).toBeUndefined();
  });

  it('resolves every name and alias in the shipped data to its own molecule', () => {
    for (const m of molecules) {
      for (const label of [m.name, ...m.aliases]) {
        expect(findMolecule(molecules, label)?.id, label).toBe(m.id);
      }
    }
  });
});

describe('suggest', () => {
  it('returns nothing for empty input', () => {
    expect(suggest(sample, '')).toEqual([]);
  });

  it('suggests by alias, one entry per molecule', () => {
    const s = suggest(sample, 'alcohol');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ label: 'alcohol', isAlias: true });
    expect(s[0]?.molecule.id).toBe('ethanol');
  });

  it('ranks prefix matches first, names before aliases', () => {
    const ids = suggest(sample, 'eth').map((s) => s.molecule.id);
    expect(ids).toEqual(['ethanol', 'acetic-acid']);
    expect(suggest(sample, 'eth')[0]?.label).toBe('Ethanol');
  });

  it('matches across spaces and hyphens', () => {
    expect(suggest(sample, 'aceticac')[0]?.molecule.id).toBe('acetic-acid');
    expect(suggest(sample, 'gamma-amino')[0]?.molecule.id).toBe('gaba');
  });

  it('honors limit and exclude', () => {
    expect(suggest(sample, 'a', { limit: 2 })).toHaveLength(2);
    const ids = suggest(sample, 'a', { exclude: ['caffeine'] }).map((s) => s.molecule.id);
    expect(ids).not.toContain('caffeine');
  });
});

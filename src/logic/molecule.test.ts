import { describe, expect, it } from 'vitest';
import { anonymizeSdf, structureKey, type Molecule } from './molecule';

import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const sdfFiles = import.meta.glob<string>('../../public/molecules/*.sdf', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const fileName = (path: string) => path.split('/').pop()!.replace(/\.sdf$/, '');
const sdfFor = (m: Molecule) => sdfFiles[`../../public/molecules/${structureKey(m.id)}.sdf`];

/** Every way a player could recognise the answer in raw text. */
const giveaways = (m: Molecule) => [m.id, m.name, ...m.aliases].map((w) => w.toLowerCase());

describe('structureKey', () => {
  it('matches structure_key() in scripts/build_data.py', () => {
    // Values printed by the Python implementation.
    expect(structureKey('caffeine')).toBe('0d27b2cf116796');
    expect(structureKey('theobromine')).toBe('0c42722f1c8a4c');
    expect(structureKey('nicotine')).toBe('11200f11f96b33');
  });

  it('is 14 hex digits and unique per molecule', () => {
    const keys = molecules.map((m) => structureKey(m.id));
    for (const k of keys) expect(k).toMatch(/^[0-9a-f]{14}$/);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only sees plain ASCII ids', () => {
    for (const m of molecules) expect(m.id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('shipped SDF files', () => {
  it('has exactly one file per molecule, named by its key', () => {
    const files = Object.keys(sdfFiles).map(fileName).sort();
    expect(files).toEqual(molecules.map((m) => structureKey(m.id)).sort());
  });

  it('file names give nothing away', () => {
    for (const name of Object.keys(sdfFiles).map(fileName)) {
      for (const m of molecules) {
        for (const word of giveaways(m).filter((w) => w.length >= 3)) {
          expect(name.includes(word.replace(/[^a-z0-9]/g, '')), `${name} vs ${word}`).toBe(false);
        }
      }
    }
  });

  it('raw files (as seen in the network tab) contain no name, alias or id', () => {
    for (const m of molecules) {
      const sdf = sdfFor(m);
      expect(sdf, m.id).toBeDefined();
      expect(sdf!.split(/\r?\n/)[0], `${m.id} title line`).toBe('');
      const lower = sdf!.toLowerCase();
      for (const word of giveaways(m)) expect(lower, `${m.id}: ${word}`).not.toContain(word);
      expect(lower.slice(lower.indexOf('m  end') + 6).trim(), `${m.id} data items`).toBe('$$$$');
    }
  });
});

describe('anonymizeSdf', () => {
  const sample = [
    'Caffeine',
    '     RDKit          3D',
    '',
    '  1  0  0  0  0  0  0  0  0  0999 V2000',
    '    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0',
    'M  END',
    '> <PUBCHEM_IUPAC_NAME>',
    'caffeine',
    '',
    '$$$$',
  ].join('\r\n');

  it('drops the title line and data items', () => {
    const out = anonymizeSdf(sample);
    expect(out.toLowerCase()).not.toContain('caffeine');
    expect(out.split('\n')[0]).toBe('');
    expect(out).toContain('M  END');
    expect(out).toContain('V2000');
  });
});

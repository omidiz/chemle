import { describe, expect, it } from 'vitest';
import { anonymizeSdf, type Molecule } from './molecule';

import moleculesJson from '../../public/data/molecules.json';

const molecules = moleculesJson as Molecule[];
const sdfFiles = import.meta.glob<string>('../../public/molecules/*.sdf', {
  query: '?raw',
  import: 'default',
  eager: true,
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

  it('removes the name from every shipped SDF', () => {
    for (const m of molecules) {
      const sdf = sdfFiles[`../../public/molecules/${m.id}.sdf`];
      expect(sdf, m.id).toBeDefined();
      const out = anonymizeSdf(sdf).toLowerCase();
      for (const word of [m.name, ...m.aliases]) {
        expect(out).not.toContain(word.toLowerCase());
      }
    }
  });
});

/** One entry of public/data/molecules.json (fields used by the game). */
export interface Molecule {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  /** One-line fact shown once the answer is revealed. */
  fact: string;
  formula: string;
  molecularWeight: number;
  heavyAtoms: number;
  rings: number;
  aromaticRings: number;
  functionalGroups: string[];
}

/**
 * Opaque key for a molecule id, used as its SDF file name and in saved
 * progress so neither the network log nor localStorage shows the answer.
 * cyrb53 hash of "chemle:" + id as 14 hex digits; must match
 * `structure_key` in scripts/build_data.py (a test checks every file).
 * Not a secret, just not readable at a glance.
 */
export function structureKey(id: string): string {
  const s = `chemle:${id}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (h2 & 0x1fffff) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Remove anything from an SDF/MOL block that could reveal the molecule's
 * name: the title line (line 1) and any `> <PROP>` data items after `M  END`.
 * Only the first record is kept.
 */
export function anonymizeSdf(sdf: string): string {
  const lines = sdf.replace(/\r\n?/g, '\n').split('\n');
  const end = lines.findIndex((l) => l.startsWith('M  END'));
  const block = end >= 0 ? lines.slice(0, end + 1) : lines;
  block[0] = '';
  return `${block.join('\n')}\n$$$$\n`;
}

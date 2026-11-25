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

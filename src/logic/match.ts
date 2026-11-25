import type { Molecule } from './molecule';

/** Normalize a name for comparison: case-insensitive, ignores spaces and hyphens. */
export function normalizeName(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s\-‐‑‒–—]+/g, '');
}

/** Find the molecule whose name or one of its aliases matches `input`. */
export function findMolecule(
  molecules: readonly Molecule[],
  input: string,
): Molecule | undefined {
  const q = normalizeName(input);
  if (!q) return undefined;
  return molecules.find(
    (m) => normalizeName(m.name) === q || m.aliases.some((a) => normalizeName(a) === q),
  );
}

export interface Suggestion {
  molecule: Molecule;
  /** The name or alias that matched (what to show / fill in). */
  label: string;
  /** True if `label` is an alias rather than the main name. */
  isAlias: boolean;
}

/**
 * Autocomplete suggestions for `input`, at most one per molecule.
 * Matches by name and aliases; prefix matches rank before substring matches,
 * main names before aliases, then alphabetical.
 */
export function suggest(
  molecules: readonly Molecule[],
  input: string,
  options: { limit?: number; exclude?: readonly string[] } = {},
): Suggestion[] {
  const { limit = 8, exclude = [] } = options;
  const q = normalizeName(input);
  if (!q) return [];

  const scored: { s: Suggestion; score: number }[] = [];
  for (const m of molecules) {
    if (exclude.includes(m.id)) continue;
    let best: { s: Suggestion; score: number } | undefined;
    const labels = [m.name, ...m.aliases];
    labels.forEach((label, i) => {
      const pos = normalizeName(label).indexOf(q);
      if (pos < 0) return;
      const score = (pos === 0 ? 0 : 2) + (i === 0 ? 0 : 1);
      if (!best || score < best.score) {
        best = { s: { molecule: m, label, isAlias: i > 0 }, score };
      }
    });
    if (best) scored.push(best);
  }
  scored.sort((a, b) => a.score - b.score || a.s.label.localeCompare(b.s.label));
  return scored.slice(0, limit).map((x) => x.s);
}

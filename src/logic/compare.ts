import type { Molecule } from './molecule';

/**
 * How close a guessed property is to the target's.
 * - match: green
 * - close: yellow
 * - miss:  gray
 */
export type Verdict = 'match' | 'close' | 'miss';

/**
 * Where the target lies relative to the guess: 'up' means the target's value
 * is higher than the guess's, 'down' lower, 'equal' the same.
 */
export type Direction = 'up' | 'down' | 'equal';

export type NumericKey = 'weight' | 'heavyAtoms' | 'rings';

export interface NumericTile {
  key: NumericKey;
  verdict: Verdict;
  direction: Direction;
  /** The guessed molecule's value (the target's is never exposed). */
  value: number;
}

export interface GroupsTile {
  key: 'groups';
  verdict: Verdict;
  /** Functional groups the guess and target share, in the guess's order. */
  shared: string[];
}

export interface CategoryTile {
  key: 'category';
  verdict: Verdict;
  value: string;
}

export type Tile = NumericTile | GroupsTile | CategoryTile;

export interface Comparison {
  weight: NumericTile;
  heavyAtoms: NumericTile;
  rings: NumericTile;
  groups: GroupsTile;
  category: CategoryTile;
}

/** Molecular weight is green within this fraction of the target's weight... */
export const WEIGHT_MATCH_RATIO = 0.1;
/** ...and yellow within this fraction. */
export const WEIGHT_CLOSE_RATIO = 0.3;
/** Heavy atom count is yellow when off by at most this many atoms. */
export const HEAVY_ATOMS_CLOSE = 3;

// Guards against float noise, e.g. 110 vs 100 being 0.10000000000000009 off.
const EPSILON = 1e-9;

export function direction(guess: number, target: number): Direction {
  if (target > guess) return 'up';
  if (target < guess) return 'down';
  return 'equal';
}

/** Green within 10% of the target's weight, yellow within 30%, else gray. */
export function compareWeight(guess: number, target: number): NumericTile {
  const off = target === 0 ? (guess === 0 ? 0 : Infinity) : Math.abs(guess - target) / target;
  const verdict: Verdict =
    off <= WEIGHT_MATCH_RATIO + EPSILON
      ? 'match'
      : off <= WEIGHT_CLOSE_RATIO + EPSILON
        ? 'close'
        : 'miss';
  return { key: 'weight', verdict, direction: direction(guess, target), value: guess };
}

/** Green if equal, yellow if within 3 atoms, else gray. */
export function compareHeavyAtoms(guess: number, target: number): NumericTile {
  const off = Math.abs(guess - target);
  const verdict: Verdict = off === 0 ? 'match' : off <= HEAVY_ATOMS_CLOSE ? 'close' : 'miss';
  return { key: 'heavyAtoms', verdict, direction: direction(guess, target), value: guess };
}

/** Green if equal, otherwise gray with an arrow. */
export function compareRings(guess: number, target: number): NumericTile {
  return {
    key: 'rings',
    verdict: guess === target ? 'match' : 'miss',
    direction: direction(guess, target),
    value: guess,
  };
}

/** Green if the sets are identical, yellow if some are shared, gray if none. */
export function compareGroups(guess: readonly string[], target: readonly string[]): GroupsTile {
  const g = new Set(guess);
  const t = new Set(target);
  const shared = [...g].filter((x) => t.has(x));
  const identical = g.size === t.size && shared.length === g.size;
  const verdict: Verdict = identical ? 'match' : shared.length > 0 ? 'close' : 'miss';
  return { key: 'groups', verdict, shared };
}

/** Green if the same category, else gray. */
export function compareCategory(guess: string, target: string): CategoryTile {
  return { key: 'category', verdict: guess === target ? 'match' : 'miss', value: guess };
}

export function compareMolecules(guess: Molecule, target: Molecule): Comparison {
  return {
    weight: compareWeight(guess.molecularWeight, target.molecularWeight),
    heavyAtoms: compareHeavyAtoms(guess.heavyAtoms, target.heavyAtoms),
    rings: compareRings(guess.rings, target.rings),
    groups: compareGroups(guess.functionalGroups, target.functionalGroups),
    category: compareCategory(guess.category, target.category),
  };
}

/** Tiles in display order. */
export function comparisonTiles(c: Comparison): Tile[] {
  return [c.weight, c.heavyAtoms, c.rings, c.category, c.groups];
}

// ---- Presentation helpers (pure, so the non-color cues are testable) ----

export const TILE_LABELS: Record<Tile['key'], string> = {
  weight: 'Weight',
  heavyAtoms: 'Atoms',
  rings: 'Rings',
  groups: 'Groups',
  category: 'Type',
};

const LONG_LABELS: Record<Tile['key'], string> = {
  weight: 'Molecular weight',
  heavyAtoms: 'Heavy atoms',
  rings: 'Rings',
  groups: 'Functional groups',
  category: 'Category',
};

/** Symbol shown on every tile so the verdict never depends on color alone. */
export function verdictIcon(v: Verdict): string {
  switch (v) {
    case 'match':
      return '✓';
    case 'close':
      return '≈';
    case 'miss':
      return '✗';
  }
}

export function verdictText(v: Verdict): string {
  switch (v) {
    case 'match':
      return 'match';
    case 'close':
      return 'close';
    case 'miss':
      return 'no match';
  }
}

/** Arrow pointing toward the target's value; empty when equal. */
export function directionArrow(d: Direction): string {
  switch (d) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'equal':
      return '';
  }
}

function directionText(d: Direction): string {
  switch (d) {
    case 'up':
      return 'target is higher';
    case 'down':
      return 'target is lower';
    case 'equal':
      return 'exact';
  }
}

/** The value shown on a tile, e.g. "194.2" or "food". */
export function tileValue(tile: Tile): string {
  switch (tile.key) {
    case 'weight':
      return tile.value.toFixed(1);
    case 'heavyAtoms':
    case 'rings':
      return String(tile.value);
    case 'category':
      return tile.value;
    case 'groups':
      return tile.shared.length ? tile.shared.join(', ') : 'none shared';
  }
}

/** Full sentence for screen readers, e.g. "Molecular weight 180.2: close, target is higher". */
export function tileDescription(tile: Tile): string {
  const label = LONG_LABELS[tile.key];
  const verdict = verdictText(tile.verdict);
  switch (tile.key) {
    case 'weight':
    case 'heavyAtoms':
    case 'rings':
      return `${label} ${tileValue(tile)}: ${verdict}, ${directionText(tile.direction)}`;
    case 'category':
      return `${label} ${tile.value}: ${verdict}`;
    case 'groups':
      return tile.shared.length
        ? `${label}: ${verdict}, shared ${tile.shared.join(', ')}`
        : `${label}: ${verdict}, none shared`;
  }
}

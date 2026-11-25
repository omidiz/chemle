import type { Molecule } from './molecule';

/** Two hand-written hints for one molecule. */
export interface MoleculeHints {
  hint1: string;
  hint2: string;
}

export type Hints = Record<string, MoleculeHints>;

/** Hint N is revealed after this many wrong guesses. */
export const HINT_AFTER_WRONG = [3, 5] as const;

/**
 * Parse data/hints.yaml. Supports the small YAML subset that file uses:
 *
 *   # comment
 *   caffeine:
 *     hint1: "A quoted hint"
 *     hint2: Plain text works too
 *
 * Values are single-line: plain, 'single-quoted' ('' = ') or
 * "double-quoted" (with \" \\ \n escapes). Throws with a line number on
 * anything else, so a typo fails the tests instead of silently losing hints.
 */
export function parseHints(text: string): Hints {
  const out: Hints = {};
  let current: Partial<MoleculeHints> | undefined;
  let currentId = '';

  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const fail = (msg: string): never => {
      throw new Error(`hints.yaml line ${lineNo}: ${msg}`);
    };
    if (/^\s*(#.*)?$/.test(raw)) return;
    if (raw.includes('\t')) fail('use spaces, not tabs');

    const top = /^([A-Za-z0-9][\w-]*)\s*:\s*(#.*)?$/.exec(raw);
    if (top) {
      currentId = top[1]!;
      if (currentId in out) fail(`duplicate molecule "${currentId}"`);
      current = {};
      out[currentId] = current as MoleculeHints;
      return;
    }

    const field = /^\s+(hint[12])\s*:\s*(.*)$/.exec(raw);
    if (field) {
      if (!current) fail(`"${field[1]}" must be under a molecule id`);
      const key = field[1] as keyof MoleculeHints;
      if (current![key] !== undefined) fail(`duplicate ${key} for "${currentId}"`);
      current![key] = parseScalar(field[2]!, fail);
      return;
    }

    fail(`expected "<molecule-id>:" or "  hint1: ..." / "  hint2: ...", got: ${raw.trim()}`);
  });

  // A missing hint becomes '' so validateHints can report it.
  for (const h of Object.values(out)) {
    h.hint1 ??= '';
    h.hint2 ??= '';
  }
  return out;
}

function parseScalar(s: string, fail: (msg: string) => never): string {
  const src = s.trim();
  if (src.startsWith('"')) {
    let value = '';
    let i = 1;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (c === '"') break;
      if (c === '\\') {
        const n = src[++i];
        if (n === 'n') value += '\n';
        else if (n === '"' || n === '\\') value += n;
        else fail(`unsupported escape "\\${n ?? ''}"`);
      } else {
        value += c;
      }
    }
    if (i >= src.length) fail('missing closing "');
    expectOnlyComment(src.slice(i + 1), fail);
    return value;
  }
  if (src.startsWith("'")) {
    let value = '';
    let i = 1;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (c === "'") {
        if (src[i + 1] === "'") {
          value += "'";
          i++;
        } else break;
      } else {
        value += c;
      }
    }
    if (i >= src.length) fail("missing closing '");
    expectOnlyComment(src.slice(i + 1), fail);
    return value;
  }
  if (/^[|>&*!%@`{[\]]/.test(src)) {
    fail('multi-line and special YAML values are not supported; put the hint in "quotes"');
  }
  // Plain scalar: a " #" starts a comment, a ": " would be a nested mapping.
  const plain = src.replace(/(^|\s)#.*$/, '').trim();
  if (/:(\s|$)/.test(plain)) fail('a hint containing ": " must be in "quotes"');
  return plain;
}

function expectOnlyComment(rest: string, fail: (msg: string) => never): void {
  if (!/^\s*(#.*)?$/.test(rest)) fail(`unexpected text after closing quote: ${rest.trim()}`);
}

/** Hints to show after `wrongGuesses` wrong guesses (0, 1 or 2 of them). */
export function revealedHints(hints: MoleculeHints | undefined, wrongGuesses: number): string[] {
  if (!hints) return [];
  const all = [hints.hint1, hints.hint2];
  return all.filter((h, i) => wrongGuesses >= HINT_AFTER_WRONG[i]! && h.trim() !== '');
}

/**
 * Problems with a hints file: molecules without both hints, ids that are not
 * molecules, and hints that give away the molecule's name or an alias.
 */
export function validateHints(hints: Hints, molecules: readonly Molecule[]): string[] {
  const problems: string[] = [];
  const ids = new Set(molecules.map((m) => m.id));
  for (const id of Object.keys(hints)) {
    if (!ids.has(id)) problems.push(`${id}: not a molecule id in molecules.json`);
  }
  for (const m of molecules) {
    const h = hints[m.id];
    if (!h) {
      problems.push(`${m.id}: no hints`);
      continue;
    }
    for (const key of ['hint1', 'hint2'] as const) {
      const text = h[key];
      if (!text.trim()) {
        problems.push(`${m.id}: ${key} is empty`);
        continue;
      }
      const spoiler = [m.name, ...m.aliases].find((n) => mentions(text, n));
      if (spoiler) problems.push(`${m.id}: ${key} gives away the answer ("${spoiler}")`);
    }
  }
  return problems;
}

/** Whether `text` contains `name` as a whole word (case-insensitive; spaces/hyphens optional). */
function mentions(text: string, name: string): boolean {
  const parts = name
    .normalize('NFKC')
    .split(/[\s\-‐‑‒–—]+/)
    .filter(Boolean)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parts.length) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('[\\s\\-‐‑‒–—]*')}(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(text.normalize('NFKC'));
}

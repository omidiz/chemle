import { describe, expect, it } from 'vitest';
import { parseHints, revealedHints, validateHints, type MoleculeHints } from './hints';
import type { Molecule } from './molecule';
import moleculesJson from '../../public/data/molecules.json';
import hintsYaml from '../../data/hints.yaml?raw';

const molecules = moleculesJson as Molecule[];

describe('parseHints', () => {
  it('parses plain, single- and double-quoted values', () => {
    const text = [
      '# comment',
      '',
      'caffeine:',
      '  hint1: Found in coffee  # trailing comment',
      '  hint2: "Has \\"four\\" N atoms: count them # not a comment"',
      'aspirin:   # comment after id',
      "  hint1: 'It''s from willow bark'",
      '  hint2: Plain text, with commas & apostrophes isn\'t a problem',
    ].join('\n');
    expect(parseHints(text)).toEqual({
      caffeine: {
        hint1: 'Found in coffee',
        hint2: 'Has "four" N atoms: count them # not a comment',
      },
      aspirin: {
        hint1: "It's from willow bark",
        hint2: "Plain text, with commas & apostrophes isn't a problem",
      },
    });
  });

  it('accepts CRLF line endings, a BOM and ids with hyphens', () => {
    expect(parseHints('﻿acetic-acid:\r\n  hint1: a\r\n  hint2: b\r\n')).toEqual({
      'acetic-acid': { hint1: 'a', hint2: 'b' },
    });
  });

  it('fills a missing hint with an empty string', () => {
    expect(parseHints('urea:\n  hint1: x\n')).toEqual({ urea: { hint1: 'x', hint2: '' } });
  });

  it.each([
    ['  hint1: x', /line 1: .*under a molecule id/],
    ['urea:\n  hint3: x', /line 2: expected/],
    ['urea:\n  hint1: a\nurea:', /line 3: duplicate molecule "urea"/],
    ['urea:\n  hint1: a\n  hint1: b', /line 3: duplicate hint1/],
    ['urea:\n  hint1: "unterminated', /line 2: missing closing "/],
    ["urea:\n  hint1: 'unterminated", /line 2: missing closing '/],
    ['urea:\n  hint1: "a" b', /line 2: unexpected text after closing quote/],
    ['urea:\n  hint1: Note: colon', /line 2: .*must be in "quotes"/],
    ['urea:\n  hint1: >', /line 2: multi-line/],
    ['urea:\n\thint1: x', /line 2: use spaces/],
    ['urea:\n  hint1: "bad \\t escape"', /line 2: unsupported escape/],
  ])('rejects %j', (text, error) => {
    expect(() => parseHints(text)).toThrow(error);
  });
});

describe('revealedHints', () => {
  const h: MoleculeHints = { hint1: 'first', hint2: 'second' };

  it('shows hint 1 after the 3rd wrong guess and hint 2 after the 5th', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => revealedHints(h, n))).toEqual([
      [],
      [],
      [],
      ['first'],
      ['first'],
      ['first', 'second'],
      ['first', 'second'],
    ]);
  });

  it('handles missing or empty hints', () => {
    expect(revealedHints(undefined, 5)).toEqual([]);
    expect(revealedHints({ hint1: ' ', hint2: 'second' }, 5)).toEqual(['second']);
  });
});

describe('validateHints', () => {
  const caffeine = molecules.find((m) => m.id === 'caffeine')!;
  const ethanol = molecules.find((m) => m.id === 'ethanol')!;

  it('reports missing molecules, empty hints and unknown ids', () => {
    const problems = validateHints(
      { caffeine: { hint1: 'ok', hint2: '' }, water: { hint1: 'a', hint2: 'b' } },
      [caffeine, ethanol],
    );
    expect(problems).toEqual([
      'water: not a molecule id in molecules.json',
      'caffeine: hint2 is empty',
      'ethanol: no hints',
    ]);
  });

  it('flags hints that mention the name or an alias as a whole word', () => {
    const problems = validateHints(
      {
        caffeine: { hint1: 'Like CAFFEINE.', hint2: 'Also called 1,3,7-Trimethylxanthine' },
        ethanol: { hint1: 'The alcohol in beer', hint2: 'Fine: ethanolamine is different' },
      },
      [caffeine, ethanol],
    );
    expect(problems).toEqual([
      'caffeine: hint1 gives away the answer ("Caffeine")',
      'caffeine: hint2 gives away the answer ("1,3,7-trimethylxanthine")',
      'ethanol: hint1 gives away the answer ("alcohol")',
    ]);
  });

  it('matches multi-word names with flexible spacing and hyphens', () => {
    const glucose = molecules.find((m) => m.id === 'glucose')!;
    expect(
      validateHints({ glucose: { hint1: 'Your blood-sugar level', hint2: 'ok' } }, [glucose]),
    ).toEqual(['glucose: hint1 gives away the answer ("blood sugar")']);
  });
});

describe('data/hints.yaml', () => {
  it('parses and has two spoiler-free hints for every molecule', () => {
    expect(validateHints(parseHints(hintsYaml), molecules)).toEqual([]);
  });
});

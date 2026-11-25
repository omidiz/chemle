import {
  compareMolecules,
  comparisonTiles,
  directionArrow,
  TILE_LABELS,
  tileDescription,
  tileValue,
  verdictIcon,
  type Tile,
} from '../logic/compare';
import { formulaParts, MAX_GUESSES, type GameState } from '../logic/game';
import type { Molecule } from '../logic/molecule';
import { countdownEl } from './stats';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * One feedback tile. The verdict is shown by color *and* an icon (✓ ≈ ✗),
 * direction by an arrow; screen readers get a full sentence instead.
 */
function tileEl(tile: Tile): HTMLLIElement {
  const li = el('li', `tile tile-${tile.key} tile-${tile.verdict}`);
  const visual = el('span', 'tile-body');
  visual.setAttribute('aria-hidden', 'true');

  const head = el('span', 'tile-head');
  head.append(el('span', 'tile-label', TILE_LABELS[tile.key]));
  head.append(el('span', 'tile-icon', verdictIcon(tile.verdict)));
  visual.append(head);

  if (tile.key === 'groups') {
    const chips = el('span', 'chips');
    if (tile.shared.length) {
      chips.append(...tile.shared.map((g) => el('span', 'chip', g)));
    } else {
      chips.append(el('span', 'chip chip-none', 'none shared'));
    }
    visual.append(chips);
  } else {
    const value = el('span', 'tile-value', tileValue(tile));
    if (tile.key !== 'category') {
      const arrow = directionArrow(tile.direction);
      if (arrow) value.append(el('span', 'tile-arrow', arrow));
    }
    visual.append(value);
  }

  li.append(visual, el('span', 'sr-only', tileDescription(tile)));
  return li;
}

function tilesEl(guess: Molecule, target: Molecule): HTMLUListElement {
  const ul = el('ul', 'tiles');
  ul.setAttribute('aria-label', `${guess.name} compared with the answer`);
  ul.append(...comparisonTiles(compareMolecules(guess, target)).map(tileEl));
  return ul;
}

export function renderGuesses(
  listEl: HTMLOListElement,
  countEl: HTMLElement,
  state: GameState,
  byId: ReadonlyMap<string, Molecule>,
): void {
  const target = byId.get(state.targetId);
  listEl.replaceChildren(
    ...state.guesses.map((id) => {
      const li = document.createElement('li');
      const correct = id === state.targetId;
      const guess = byId.get(id);
      li.className = `guess ${correct ? 'guess-correct' : 'guess-wrong'}`;
      const head = el('div', 'guess-head');
      const mark = document.createElement('span');
      mark.className = 'guess-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = correct ? '✓' : '✗';
      const name = document.createElement('span');
      name.textContent = guess?.name ?? id;
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = correct ? ' (correct)' : ' (wrong)';
      head.append(mark, name, sr);
      li.append(head);
      if (!correct && guess && target) li.append(tilesEl(guess, target));
      return li;
    }),
  );
  countEl.textContent = `Guess ${Math.min(state.guesses.length + 1, MAX_GUESSES)} of ${MAX_GUESSES}`;
}

/** Show the revealed hints (hidden while there are none). */
export function renderHints(panel: HTMLElement, hints: readonly string[]): void {
  panel.replaceChildren(
    ...hints.map((text, i) => {
      const p = el('p', 'hint');
      p.append(el('strong', 'hint-label', `Hint ${i + 1}`), ' ', text);
      return p;
    }),
  );
  panel.hidden = hints.length === 0;
}

function formulaEl(formula: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'formula';
  for (const p of formulaParts(formula)) {
    if (p.sub) {
      const sub = document.createElement('sub');
      sub.textContent = p.text;
      el.append(sub);
    } else {
      el.append(p.text);
    }
  }
  return el;
}

/**
 * Fill the end-of-game panel (success or reveal) with a countdown to the
 * next puzzle and a button that opens the stats, then show it.
 */
export function renderEnd(
  panel: HTMLElement,
  state: GameState,
  target: Molecule,
  onShowStats: () => void,
): void {
  const won = state.status === 'won';
  panel.className = `end ${won ? 'end-won' : 'end-lost'}`;

  const heading = document.createElement('h2');
  heading.className = 'end-heading';
  heading.textContent = won
    ? `Solved in ${state.guesses.length}/${MAX_GUESSES}!`
    : 'Out of guesses — the answer was';

  const name = document.createElement('p');
  name.className = 'end-name';
  name.textContent = target.name;

  const formula = document.createElement('p');
  formula.className = 'end-formula';
  formula.append(formulaEl(target.formula));

  const fact = document.createElement('p');
  fact.className = 'end-fact';
  fact.textContent = target.fact;

  const statsButton = el('button', 'stats-link', 'See your stats');
  statsButton.type = 'button';
  statsButton.addEventListener('click', onShowStats);

  panel.replaceChildren(heading, name, formula, fact, countdownEl(), statsButton);
  panel.hidden = false;
  panel.focus();
}

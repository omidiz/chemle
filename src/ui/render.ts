import { formulaParts, MAX_GUESSES, type GameState } from '../logic/game';
import type { Molecule } from '../logic/molecule';

export function renderGuesses(
  listEl: HTMLOListElement,
  countEl: HTMLElement,
  state: GameState,
  byId: ReadonlyMap<string, Molecule>,
): void {
  listEl.replaceChildren(
    ...state.guesses.map((id) => {
      const li = document.createElement('li');
      const correct = id === state.targetId;
      li.className = `guess ${correct ? 'guess-correct' : 'guess-wrong'}`;
      const mark = document.createElement('span');
      mark.className = 'guess-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = correct ? '✓' : '✗';
      const name = document.createElement('span');
      name.textContent = byId.get(id)?.name ?? id;
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = correct ? ' (correct)' : ' (wrong)';
      li.append(mark, name, sr);
      return li;
    }),
  );
  countEl.textContent = `Guess ${Math.min(state.guesses.length + 1, MAX_GUESSES)} of ${MAX_GUESSES}`;
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

/** Fill the end-of-game panel (success or reveal) and show it. */
export function renderEnd(panel: HTMLElement, state: GameState, target: Molecule): void {
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

  panel.replaceChildren(heading, name, formula, fact);
  panel.hidden = false;
  panel.focus();
}

import { suggest, type Suggestion } from '../logic/match';
import type { Molecule } from '../logic/molecule';

export interface GuessInput {
  setError(message: string): void;
  disable(): void;
  clear(): void;
}

/**
 * Text input with an autocomplete list (ARIA combobox). Calls `onSubmit`
 * with the raw text; validation is up to the caller.
 */
export function mountGuessInput(
  form: HTMLFormElement,
  molecules: readonly Molecule[],
  getExcluded: () => readonly string[],
  onSubmit: (text: string) => void,
): GuessInput {
  const input = form.querySelector<HTMLInputElement>('input')!;
  const list = form.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const error = form.querySelector<HTMLParagraphElement>('.guess-error')!;
  const button = form.querySelector<HTMLButtonElement>('button')!;

  let items: Suggestion[] = [];
  let active = -1;

  const render = () => {
    list.replaceChildren(
      ...items.map((s, i) => {
        const li = document.createElement('li');
        li.id = `suggestion-${i}`;
        li.setAttribute('role', 'option');
        li.className = 'suggestion';
        li.setAttribute('aria-selected', String(i === active));
        li.textContent = s.label;
        if (s.isAlias) {
          const hint = document.createElement('span');
          hint.className = 'suggestion-alias';
          hint.textContent = ` → ${s.molecule.name}`;
          li.append(hint);
        }
        // pointerdown + preventDefault keeps focus (and the keyboard) on the input.
        li.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(i);
        });
        return li;
      }),
    );
    const open = items.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (active >= 0) input.setAttribute('aria-activedescendant', `suggestion-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const update = () => {
    items = suggest(molecules, input.value, { exclude: getExcluded() });
    active = -1;
    render();
  };

  const close = () => {
    items = [];
    active = -1;
    render();
  };

  const choose = (i: number) => {
    const s = items[i];
    if (!s) return;
    input.value = s.label;
    close();
    submit();
  };

  const submit = () => {
    close();
    onSubmit(input.value);
  };

  input.addEventListener('input', () => {
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    update();
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      // Cycle through -1 (nothing highlighted), 0, …, n-1.
      const n = items.length + 1;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      active = ((active + 1 + d + n) % n) - 1;
      render();
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(active);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  return {
    setError(message) {
      error.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    },
    disable() {
      close();
      input.disabled = true;
      button.disabled = true;
    },
    clear() {
      input.value = '';
      error.textContent = '';
      input.removeAttribute('aria-invalid');
    },
  };
}

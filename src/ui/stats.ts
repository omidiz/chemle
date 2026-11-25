import { formatCountdown, msUntilNextPuzzle, puzzleNumber } from '../logic/daily';
import { currentStreak, winPercent, type Stats } from '../logic/stats';

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

function statEl(value: number | string, label: string): HTMLElement {
  const div = el('div', 'stat');
  div.append(el('span', 'stat-value', String(value)), el('span', 'stat-label', label));
  return div;
}

/**
 * Fill the stats dialog body. `highlight` is today's winning guess count
 * (1–6), whose bar is drawn in the accent color.
 */
export function renderStats(
  body: HTMLElement,
  stats: Stats,
  today: number,
  highlight: number | null,
  showCountdown: boolean,
): void {
  const numbers = el('div', 'stats-numbers');
  numbers.append(
    statEl(stats.played, 'Played'),
    statEl(winPercent(stats), 'Win %'),
    statEl(currentStreak(stats, today), 'Current streak'),
    statEl(stats.maxStreak, 'Max streak'),
  );

  const heading = el('h3', 'dist-heading', 'Guess distribution');
  heading.id = 'dist-heading';
  const dist = el('ol', 'dist');
  dist.setAttribute('aria-labelledby', 'dist-heading');
  const max = Math.max(1, ...stats.distribution);
  dist.append(
    ...stats.distribution.map((count, i) => {
      const li = el('li', 'dist-row');
      const visual = el('span', 'dist-visual');
      visual.setAttribute('aria-hidden', 'true');
      const bar = el('span', `dist-bar${highlight === i + 1 ? ' dist-bar-today' : ''}`);
      bar.style.width = `${Math.max(8, (count / max) * 100)}%`;
      bar.append(el('span', 'dist-count', String(count)));
      visual.append(el('span', 'dist-guess', String(i + 1)), bar);
      const n = i + 1;
      const sr = `Solved in ${n} guess${n === 1 ? '' : 'es'}: ${count} time${count === 1 ? '' : 's'}`;
      li.append(visual, el('span', 'sr-only', sr));
      return li;
    }),
  );

  body.replaceChildren(numbers, heading, dist);
  if (showCountdown) body.append(countdownEl());
}

/** "Next molecule in HH:MM:SS"; kept ticking by `startCountdowns`. */
export function countdownEl(): HTMLElement {
  const p = el('p', 'countdown');
  p.append('Next molecule in ', el('span', 'countdown-time', formatCountdown(msUntilNextPuzzle(new Date()))));
  return p;
}

/**
 * Tick every `.countdown` on the page once a second. Once the local date
 * moves past `puzzle`, they turn into a button that reloads the page.
 */
export function startCountdowns(puzzle: number): void {
  const tick = () => {
    const now = new Date();
    const newDay = puzzleNumber(now) !== puzzle;
    for (const c of document.querySelectorAll<HTMLElement>('.countdown')) {
      const time = c.querySelector('.countdown-time');
      if (!time) continue;
      if (newDay) {
        const button = el('button', 'reload-button', 'Play the new molecule');
        button.type = 'button';
        button.addEventListener('click', () => location.reload());
        c.replaceChildren(button);
      } else {
        time.textContent = formatCountdown(msUntilNextPuzzle(now));
      }
    }
  };
  tick();
  setInterval(tick, 1000);
}

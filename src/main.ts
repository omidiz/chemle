import './style.css';
import hintsYaml from '../data/hints.yaml?raw';
import { moleculeForPuzzle, puzzleNumber } from './logic/daily';
import { errorMessage, restoreGame, submitGuess, wrongGuessCount } from './logic/game';
import { parseHints, revealedHints, type Hints } from './logic/hints';
import { anonymizeSdf, type Molecule } from './logic/molecule';
import { moleculesJsonUrl, sdfUrl } from './logic/paths';
import { shareText } from './logic/share';
import { recordResult } from './logic/stats';
import {
  hasSeenHelp,
  loadProgress,
  loadStats,
  markHelpSeen,
  saveProgress,
  saveStats,
  type KeyValueStore,
} from './logic/storage';
import { mountGuessInput } from './ui/guessInput';
import { renderEnd, renderGuesses, renderHints } from './ui/render';
import { shareResult } from './ui/share';
import { renderStats, startCountdowns } from './ui/stats';
import { showMolecule } from './viewer/viewer';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

/** localStorage, or an in-memory stand-in where it's unavailable. */
function storage(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

async function start(): Promise<void> {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const viewerEl = $<HTMLDivElement>('#viewer');
  const statusEl = $<HTMLParagraphElement>('#status');
  const form = $<HTMLFormElement>('#guess-form');
  const guessList = $<HTMLOListElement>('#guesses');
  const countEl = $<HTMLParagraphElement>('#guess-count');
  const endEl = $<HTMLElement>('#end');
  const hintsEl = $<HTMLElement>('#hints');
  const statsDialog = $<HTMLDialogElement>('#stats');
  const helpDialog = $<HTMLDialogElement>('#help');
  const statsBody = $<HTMLElement>('#stats-body');

  const store = storage();
  const puzzle = puzzleNumber(new Date());
  $('#puzzle-number').textContent = `#${puzzle}`;
  document.title = `Chemle #${puzzle}`;

  let stats = loadStats(store);
  let finished = false;
  let todayGuesses: number | null = null; // winning guess count, for the chart
  const openStats = () => {
    renderStats(statsBody, stats, puzzle, todayGuesses, finished);
    statsDialog.showModal();
  };
  $('#stats-button').addEventListener('click', openStats);
  for (const dialog of [statsDialog, helpDialog]) {
    for (const b of dialog.querySelectorAll('.dialog-close, .help-play')) {
      b.addEventListener('click', () => dialog.close());
    }
    // Clicking the backdrop (outside the dialog box) closes it too.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
  $('#help-button').addEventListener('click', () => helpDialog.showModal());
  // First visit: explain the rules once.
  if (!hasSeenHelp(store)) {
    helpDialog.showModal();
    markHelpSeen(store);
  }

  let hints: Hints = {};
  try {
    hints = parseHints(hintsYaml);
  } catch (err) {
    console.error(err); // The game still works without hints.
  }

  let molecules: Molecule[];
  let target: Molecule;
  try {
    molecules = JSON.parse(await fetchText(moleculesJsonUrl())) as Molecule[];
    target = moleculeForPuzzle(molecules, puzzle);
    const sdf = anonymizeSdf(await fetchText(sdfUrl(target.id)));
    showMolecule(viewerEl, sdf);
    statusEl.textContent = 'Drag to rotate · pinch to zoom';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not load today’s molecule.';
    return;
  }

  const byId = new Map(molecules.map((m) => [m.id, m]));
  const saved = loadProgress(store);
  const resumed = saved?.puzzle === puzzle && saved.targetId === target.id;
  let state = restoreGame(target, resumed ? saved.guesses : [], molecules);

  let shownHints = 0;
  /** `animate`: the last guess (and any newly revealed hint) was just made. */
  const render = (animate = false) => {
    renderGuesses(guessList, countEl, state, byId, animate);
    const revealed = revealedHints(hints[target.id], wrongGuessCount(state));
    renderHints(hintsEl, revealed, animate ? shownHints : Infinity);
    shownHints = revealed.length;
  };

  /** Show the end screen. Stats are recorded once per puzzle (reloads are safe). */
  const finish = (justEnded: boolean) => {
    finished = true;
    const won = state.status === 'won';
    todayGuesses = won ? state.guesses.length : null;
    stats = recordResult(stats, puzzle, won, state.guesses.length);
    saveStats(store, stats);
    guessInput.disable();
    form.hidden = true;
    countEl.hidden = true;
    renderEnd(endEl, state, target, openStats, () => {
      void shareResult(shareText(state, byId, puzzle));
    });
    endEl.classList.toggle('end-new', justEnded);
    startCountdowns(puzzle);
    if (justEnded) setTimeout(openStats, 1200);
  };

  const guessInput = mountGuessInput(
    form,
    molecules,
    () => state.guesses,
    (text) => {
      const result = submitGuess(state, text, molecules);
      if (!result.ok) {
        guessInput.setError(errorMessage(result.error));
        return;
      }
      state = result.state;
      saveProgress(store, { puzzle, targetId: target.id, guesses: state.guesses });
      guessInput.clear();
      render(true);
      if (state.status !== 'playing') finish(true);
    },
  );

  render();
  if (state.status === 'playing') form.hidden = false;
  else finish(false);
}

void start();

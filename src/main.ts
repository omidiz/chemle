import './style.css';
import { errorMessage, newGame, submitGuess } from './logic/game';
import { anonymizeSdf, pickMolecule, type Molecule } from './logic/molecule';
import { moleculesJsonUrl, sdfUrl } from './logic/paths';
import { mountGuessInput } from './ui/guessInput';
import { renderEnd, renderGuesses } from './ui/render';
import { showMolecule } from './viewer/viewer';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

async function start(): Promise<void> {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const viewerEl = $<HTMLDivElement>('#viewer');
  const statusEl = $<HTMLParagraphElement>('#status');
  const form = $<HTMLFormElement>('#guess-form');
  const guessList = $<HTMLOListElement>('#guesses');
  const countEl = $<HTMLParagraphElement>('#guess-count');
  const endEl = $<HTMLElement>('#end');

  let molecules: Molecule[];
  let target: Molecule;
  try {
    molecules = JSON.parse(await fetchText(moleculesJsonUrl())) as Molecule[];
    target = pickMolecule(molecules);
    const sdf = anonymizeSdf(await fetchText(sdfUrl(target.id)));
    showMolecule(viewerEl, sdf);
    statusEl.textContent = 'Drag to rotate · pinch to zoom';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not load today’s molecule.';
    return;
  }

  const byId = new Map(molecules.map((m) => [m.id, m]));
  let state = newGame(target);

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
      guessInput.clear();
      renderGuesses(guessList, countEl, state, byId);
      if (state.status !== 'playing') {
        guessInput.disable();
        form.hidden = true;
        countEl.hidden = true;
        renderEnd(endEl, state, target);
      }
    },
  );

  renderGuesses(guessList, countEl, state, byId);
  form.hidden = false;
}

void start();

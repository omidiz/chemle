import './style.css';
import { anonymizeSdf, pickMolecule, type Molecule } from './logic/molecule';
import { moleculesJsonUrl, sdfUrl } from './logic/paths';
import { showMolecule } from './viewer/viewer';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

async function start(): Promise<void> {
  const viewerEl = document.querySelector<HTMLDivElement>('#viewer');
  const statusEl = document.querySelector<HTMLParagraphElement>('#status');
  if (!viewerEl || !statusEl) return;

  try {
    const molecules = JSON.parse(await fetchText(moleculesJsonUrl())) as Molecule[];
    const target = pickMolecule(molecules);
    const sdf = anonymizeSdf(await fetchText(sdfUrl(target.id)));
    showMolecule(viewerEl, sdf);
    statusEl.textContent = 'Drag to rotate · pinch to zoom';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not load today’s molecule.';
  }
}

void start();

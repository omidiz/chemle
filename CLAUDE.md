# Chemle — daily 3D molecule guessing game

## Concept
Every day one well-known molecule (caffeine, dopamine, ibuprofen...) is shown
as a rotatable 3D model without its name. The player has 6 guesses.
After each wrong guess, the game compares the guess with the target
(molecular weight, atom count, rings, functional groups, category).
After guess 3 and guess 5, a hand-written hint is revealed.

## Tech stack
- Vite + vanilla TypeScript (no UI framework)
- 3Dmol.js for 3D rendering
- Static data only, no backend
- localStorage for stats and streaks
- Vitest for tests
- Deployed on GitHub Pages at https://omidiz.github.io/chemle/
  (.github/workflows/deploy.yml on push to main; ci.yml runs tests + build on PRs)
- Vite `base` is `/chemle/`: load files from public/ via src/logic/paths.ts
  (`assetUrl`, `moleculesJsonUrl`, `sdfUrl`), never with absolute `/data/...` paths

## Data
- scripts/build_data.py (Python, PubChem + RDKit) generates:
  - public/data/molecules.json
  - public/molecules/<id>.sdf (3D structures)
- data/hints.yaml: hand-written hints, edited by the human only. Bundled via
  `?raw` and parsed by src/logic/hints.ts (a small YAML subset: one-line
  `hint1`/`hint2` per molecule id; no YAML dependency). A test checks every
  molecule has both hints and none gives away the name or an alias.

## Rules
- Keep it simple; ask before adding new dependencies
- Mobile-first, works on small screens
- The daily puzzle is deterministic from the date (same for every player)
- Keep game logic in pure functions in src/logic/ so it can be unit-tested

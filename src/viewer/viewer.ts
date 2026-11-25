import { createViewer } from '3dmol';

export interface MoleculeViewer {
  destroy(): void;
}

const SPIN_SPEED = 0.4;
/** Degrees per arrow-key press, and zoom factor per +/- press. */
const KEY_ROTATE_DEG = 15;
const KEY_ZOOM = 1.2;

/**
 * Render an (anonymized) SDF as ball-and-stick with standard (Jmol/CPK)
 * element colors. Slowly auto-rotates until the user touches or drags.
 * When focused, arrow keys rotate and +/- zoom, so it works without a mouse.
 */
export function showMolecule(container: HTMLElement, sdf: string): MoleculeViewer {
  // 3Dmol doesn't fail when WebGL is missing; it just draws nothing. Check
  // first so the caller can show a message instead of an empty box.
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) {
    throw new Error('WebGL is not available');
  }
  // Transparent canvas: the container's CSS background shows through, so the
  // viewer follows light/dark mode without re-rendering.
  const viewer = createViewer(container, {
    backgroundColor: 'white',
    backgroundAlpha: 0,
    antialias: true,
  });

  viewer.addModel(sdf, 'sdf');
  viewer.setStyle(
    {},
    {
      stick: { radius: 0.14, colorscheme: 'Jmol' },
      sphere: { scale: 0.28, colorscheme: 'Jmol' },
    },
  );
  viewer.zoomTo();
  viewer.render();
  viewer.spin('y', SPIN_SPEED);

  const stopSpin = () => {
    viewer.spin(false);
    container.removeEventListener('pointerdown', stopSpin);
    container.removeEventListener('touchstart', stopSpin);
    container.removeEventListener('wheel', stopSpin);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const rotations: Record<string, [number, 'x' | 'y']> = {
      ArrowLeft: [-KEY_ROTATE_DEG, 'y'],
      ArrowRight: [KEY_ROTATE_DEG, 'y'],
      ArrowUp: [-KEY_ROTATE_DEG, 'x'],
      ArrowDown: [KEY_ROTATE_DEG, 'x'],
    };
    const rot = rotations[e.key];
    if (rot) viewer.rotate(rot[0], rot[1]);
    else if (e.key === '+' || e.key === '=') viewer.zoom(KEY_ZOOM);
    else if (e.key === '-' || e.key === '_') viewer.zoom(1 / KEY_ZOOM);
    else return;
    e.preventDefault(); // don't scroll the page
    stopSpin();
    viewer.render();
  };
  container.addEventListener('keydown', onKey);
  container.addEventListener('pointerdown', stopSpin);
  container.addEventListener('touchstart', stopSpin, { passive: true });
  container.addEventListener('wheel', stopSpin, { passive: true });

  const onResize = () => {
    viewer.resize();
    viewer.render();
  };
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      stopSpin();
      container.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      viewer.clear();
    },
  };
}

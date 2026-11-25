import { createViewer } from '3dmol';

export interface MoleculeViewer {
  destroy(): void;
}

const SPIN_SPEED = 0.4;

/**
 * Render an (anonymized) SDF as ball-and-stick with standard (Jmol/CPK)
 * element colors. Slowly auto-rotates until the user touches or drags.
 */
export function showMolecule(container: HTMLElement, sdf: string): MoleculeViewer {
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
      window.removeEventListener('resize', onResize);
      viewer.clear();
    },
  };
}

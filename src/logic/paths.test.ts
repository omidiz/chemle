import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';
import { assetUrl, moleculesJsonUrl, sdfUrl } from './paths';

describe('asset paths', () => {
  it('builds for the GitHub Pages base', () => {
    expect(viteConfig).toMatchObject({ base: '/chemle/' });
  });

  it('defaults to Vite BASE_URL', () => {
    const base = import.meta.env.BASE_URL;
    expect(moleculesJsonUrl()).toBe(`${base}data/molecules.json`);
    expect(sdfUrl('caffeine')).toBe(`${base}molecules/caffeine.sdf`);
  });

  it('builds data and SDF URLs under /chemle/', () => {
    expect(moleculesJsonUrl('/chemle/')).toBe('/chemle/data/molecules.json');
    expect(sdfUrl('caffeine', '/chemle/')).toBe('/chemle/molecules/caffeine.sdf');
  });

  it('joins base and path with exactly one slash', () => {
    expect(assetUrl('/data/x.json', '/chemle/')).toBe('/chemle/data/x.json');
    expect(assetUrl('data/x.json', '/chemle')).toBe('/chemle/data/x.json');
    expect(assetUrl('data/x.json', '/')).toBe('/data/x.json');
  });
});

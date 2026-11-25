/**
 * Build URLs for static files in public/ so they resolve under Vite's `base`
 * (e.g. '/chemle/' on GitHub Pages). Never fetch '/data/...' directly:
 * an absolute path would skip the base and 404 in production.
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return prefix + path.replace(/^\/+/, '');
}

export function moleculesJsonUrl(base?: string): string {
  return assetUrl('data/molecules.json', base);
}

export function sdfUrl(id: string, base?: string): string {
  return assetUrl(`molecules/${encodeURIComponent(id)}.sdf`, base);
}

/**
 * Base-path aware URL helpers.
 *
 * `import.meta.env.BASE_URL` is `/` for this user site (jtcowin.github.io) and for a
 * custom domain, and would be `/<repo>/` if the code moved to a project-site repo.
 * Every internal href, asset path, and canonical URL in the project must go through
 * these helpers so the site can move between those targets without restructuring.
 */

const RAW_BASE = import.meta.env.BASE_URL || '/';

/** Base path with exactly one trailing slash, e.g. `/` or `/<repo>/`. */
export const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;

/**
 * Prefix a site-relative path with the base path.
 *   withBase('/work/creator-campaigns/') -> '/work/creator-campaigns/'
 *   withBase('/')                        -> '/'
 *   withBase('#work')                    -> '/#work'
 * (each prefixed with `/<repo>` when deployed as a project site)
 */
export function withBase(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('tel:')) {
    return path;
  }
  if (path.startsWith('#')) return `${BASE}${path}`;
  const clean = path.replace(/^\/+/, '');
  return `${BASE}${clean}`;
}

/** Absolute URL for canonical links and social metadata. */
export function absoluteUrl(path: string, site: URL | undefined): string {
  const rel = withBase(path);
  if (!site) return rel;
  return new URL(rel, site).toString();
}

/** Ensure a page path ends with a trailing slash (matches `trailingSlash: 'always'`). */
export function pagePath(path: string): string {
  if (path.includes('#') || path.includes('.')) return path;
  return path.endsWith('/') ? path : `${path}/`;
}

// Deployment target resolution.
//
// This repository is named `jtcowin.github.io`, which GitHub treats as a *user site*:
// it is served from the root of the domain, so the base path is `/`, not `/<repo>`.
//
//   Default:       https://jtcowin.github.io/
//   Custom domain: create `public/CNAME` containing the bare domain (e.g. `johncowin.com`).
//                  The site URL becomes https://<domain>/ and the base path stays `/`.
//   Overrides:     set SITE_URL and/or BASE_PATH environment variables at build time.
//
// If this code is ever moved into a normally-named repository (a *project site* such as
// `jtcowin/portfolio`), the base path automatically becomes `/<repo>` — just update
// GITHUB_REPO below. Nothing in src/ hardcodes the base path; every URL routes through
// src/lib/paths.ts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const GITHUB_OWNER = 'jtcowin';
export const GITHUB_REPO = 'jtcowin.github.io';

/** A repo named `<owner>.github.io` is a user site and is served from the domain root. */
export const IS_USER_SITE = GITHUB_REPO.toLowerCase() === `${GITHUB_OWNER.toLowerCase()}.github.io`;

export function readCname() {
  const cnamePath = path.join(here, 'public', 'CNAME');
  if (!fs.existsSync(cnamePath)) return null;
  const domain = fs.readFileSync(cnamePath, 'utf8').trim().toLowerCase();
  return domain.length ? domain : null;
}

export function resolveSite() {
  const cname = readCname();

  let site = process.env.SITE_URL;
  let base = process.env.BASE_PATH;

  if (!site) {
    site = cname ? `https://${cname}` : `https://${GITHUB_OWNER}.github.io`;
  }
  if (!base) {
    base = cname || IS_USER_SITE ? '/' : `/${GITHUB_REPO}`;
  }

  // Normalize: base always starts with `/` and never ends with `/` unless it is the root.
  if (!base.startsWith('/')) base = `/${base}`;
  if (base.length > 1 && base.endsWith('/')) base = base.slice(0, -1);

  return { site, base, cname };
}

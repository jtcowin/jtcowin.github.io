// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { resolveSite } from './site.config.mjs';

// `site` and `base` are resolved from site.config.mjs. This repo is a GitHub Pages
// user site, so it builds for https://jtcowin.github.io/ at base "/"; dropping a
// `public/CNAME` file switches it to that custom domain, also at "/". Neither
// requires touching layout code.
const { site, base } = resolveSite();

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      // The 404 page should not be advertised to crawlers.
      filter: (page) => !page.endsWith('/404/') && !page.endsWith('/404'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Restrict remote images to none; all media is local and reviewed.
    domains: [],
  },
  devToolbar: { enabled: false },
});

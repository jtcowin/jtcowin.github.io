import type { APIRoute } from 'astro';
import site from '@data/site.json';

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: base,
    scope: base,
    display: 'browser',
    background_color: '#fafaf8',
    theme_color: '#fafaf8',
    icons: [
      { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};

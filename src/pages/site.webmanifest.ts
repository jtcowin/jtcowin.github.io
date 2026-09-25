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
    background_color: '#f3efe8',
    theme_color: '#f3efe8',
    icons: [
      { src: `${base}favicon-32.png`, sizes: '32x32', type: 'image/png' },
      { src: `${base}apple-touch-icon.png`, sizes: '180x180', type: 'image/png' },
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};

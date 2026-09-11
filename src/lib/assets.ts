import type { ImageMetadata } from 'astro';
import manifest from '@data/assets.json';
import logosData from '@data/logos.json';

export type Permission = 'pending' | 'approved' | 'redacted' | 'private-only';

export type AssetType =
  | 'image'
  | 'video'
  | 'metric'
  | 'gallery'
  | 'creator'
  | 'analytics'
  | 'testimonial'
  | 'artifact'
  | 'code'
  | 'link'
  | 'article'
  | 'slides'
  | 'og';

export interface GalleryItem {
  file: string;
  alt: string;
  credit?: string | null;
}

export interface AssetEntry {
  id: string;
  page: string;
  section: string;
  type: AssetType;
  aspect: string;
  label: string;
  filename: string | null;
  file: string | null;
  poster?: string | null;
  alt: string;
  source?: string | null;
  externalUrl?: string | null;
  permission: Permission;
  credit?: string | null;
  variant?: 'light' | 'dark';
  optional?: boolean;
  // metric
  value?: string;
  metricLabel?: string;
  // gallery
  slots?: number;
  items?: GalleryItem[];
  // creator
  name?: string;
  affiliation?: string | null;
  affiliationNote?: string | null;
  handle?: string | null;
  // testimonial
  quote?: string | null;
  attribution?: string | null;
  // link
  url?: string;
  // article
  articleTitle?: string;
  articleNote?: string | null;
  postViews?: string | null;
}

export interface LogoEntry {
  id: string;
  name: string;
  relationship: string;
  file: string | null;
  permission: Permission;
  url: string | null;
  inBar: boolean;
}

const entries = (manifest as { assets: AssetEntry[] }).assets;
const byId = new Map(entries.map((a) => [a.id, a]));

/**
 * Every file under src/assets is eagerly imported so the manifest can reference
 * images by relative filename and Astro can still optimize them at build time.
 */
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{png,jpg,jpeg,webp,avif,gif,svg}',
  { eager: true },
);

function findImage(file: string | null | undefined): ImageMetadata | null {
  if (!file) return null;
  const key = `/src/assets/${file.replace(/^\/+/, '')}`;
  return imageModules[key]?.default ?? null;
}

export function getAsset(id: string): AssetEntry {
  const entry = byId.get(id);
  if (!entry) {
    throw new Error(`[assets] Unknown asset id "${id}". Add it to src/data/assets.json.`);
  }
  return entry;
}

export function hasAsset(id: string): boolean {
  return byId.has(id);
}

/** Whether the entry may render real media (a file exists and permission allows it). */
export function isRenderable(entry: AssetEntry): boolean {
  if (entry.permission === 'private-only') return false;
  if (entry.type === 'video') return Boolean(entry.poster || entry.file);
  return Boolean(entry.file);
}

/** Resolved optimized image for an entry (or its poster, for video), if present. */
export function resolveImage(entry: AssetEntry): ImageMetadata | null {
  if (entry.permission === 'private-only') return null;
  if (entry.type === 'video') return findImage(entry.poster ?? null);
  return findImage(entry.file);
}

export interface ResolvedGalleryImage {
  image: ImageMetadata;
  alt: string;
  credit?: string | null;
}

export function resolveGalleryImages(entry: AssetEntry): ResolvedGalleryImage[] {
  if (entry.permission === 'private-only') return [];
  const out: ResolvedGalleryImage[] = [];
  for (const item of entry.items ?? []) {
    const image = findImage(item.file);
    if (image) out.push({ image, alt: item.alt, credit: item.credit });
  }
  return out;
}

/** `"16:9"` -> `16 / 9` for CSS aspect-ratio. */
export function aspectToCss(aspect: string): string {
  if (!aspect || aspect === 'auto') return 'auto';
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return 'auto';
  return `${w} / ${h}`;
}

export function allAssets(): AssetEntry[] {
  return entries;
}

export const logos = (logosData as { heading: string; logos: LogoEntry[] });

export function getLogo(id: string): LogoEntry {
  const logo = logos.logos.find((l) => l.id === id);
  if (!logo) throw new Error(`[logos] Unknown logo id "${id}". Add it to src/data/logos.json.`);
  return logo;
}

export function resolveLogoImage(logo: LogoEntry): ImageMetadata | null {
  if (logo.permission !== 'approved') return null;
  return findImage(logo.file ? `logos/${logo.file.replace(/^logos\//, '')}` : null);
}

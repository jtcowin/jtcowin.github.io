import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Case studies live in src/content/work/*.mdx.
 * Frontmatter carries the structured parts (metadata, hero, results);
 * the MDX body carries the narrative sections and placeholder components.
 */
const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/work' }),
  schema: z.object({
    order: z.number(),
    /** Browser tab / OG title, without the site suffix. */
    title: z.string(),
    description: z.string(),
    /** Short label used in navigation menus and cards. */
    navLabel: z.string(),
    eyebrow: z.string(),
    headline: z.string(),
    intro: z.string(),
    /** Asset manifest id for the page hero. */
    heroAsset: z.string(),
    /** Asset manifest id for the social preview image. */
    ogAsset: z.string(),
    results: z.array(z.string()).min(1),
    /** Homepage card content. */
    card: z.object({
      category: z.string(),
      title: z.string(),
      summary: z.string(),
      metrics: z.array(z.string()).min(1),
      linkLabel: z.string(),
      asset: z.string(),
    }),
  }),
});

export const collections = { work };

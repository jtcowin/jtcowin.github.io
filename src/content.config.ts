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
    /**
     * One compact line naming John's part in the work, shown under the intro
     * as "My role: ...": the responsibilities that apply to this case study,
     * including how he briefed, shaped, approved and distributed work made
     * with designers, editors and creators.
     */
    role: z.string().optional(),
    /** Asset manifest id for the page hero. */
    heroAsset: z.string(),
    /** Asset manifest id for the social preview image. */
    ogAsset: z.string(),
    results: z.array(z.string()).min(1),
    /** Homepage Select Work card: one shared template for every case study. */
    card: z.object({
      /** Compact label beside the card number. */
      category: z.string(),
      title: z.string(),
      /** One sentence, about 95 to 125 characters (130 at most). */
      subline: z.string().max(130),
      linkLabel: z.string(),
      media: z.object({
        /** Asset id for the dominant panel (a still, or a video's poster). */
        main: z.string(),
        /** Optional muted loop for the dominant panel. */
        motion: z.string().optional(),
        /**
         * Asset ids for the two supporting panels. A still shows as an image;
         * a video entry becomes a secondary motion tile, which shows its
         * poster and plays only when the visitor asks (a hover preview with a
         * fine pointer, or its play button).
         */
        side: z.tuple([z.string(), z.string()]),
        /**
         * Typographic stand-ins, in slot order, while an id has no approved
         * file (null for a slot that needs none).
         */
        fallback: z.tuple([z.string().nullable(), z.string().nullable(), z.string().nullable()]).optional(),
        /**
         * Optional fit per slot, in the same order: `contain` shows the whole
         * image, uncropped, on a plate of its own background (the asset's
         * `plate` color) with a little room around it. Omitted means cover.
         */
        fit: z.array(z.enum(['cover', 'contain'])).max(3).optional(),
        /**
         * Optional CSS object-position per slot, in the same order (main, then
         * the two sides), for an image whose panel crops it: which part stays
         * in view. Omitted or empty means centered.
         */
        focus: z.array(z.string()).max(3).optional(),
      }),
    }),
  }),
});

export const collections = { work };

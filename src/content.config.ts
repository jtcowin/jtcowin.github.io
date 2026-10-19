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
        /**
         * Full Site Iteration V1: one landscape video for the whole card, an
         * approved video entry in the asset manifest. It takes the card's full
         * media width in the same frame and treatment as the other cards, sits
         * on its own poster (the entry's still) until it plays, and plays muted,
         * on its own only while its card is the active one in the stack. Since
         * Full Site Iteration V1.1 the frame is an exact 16:9 at every width and
         * the video shows whole, so there is no crop to steer (the `focus`
         * option that steered it is gone).
         */
        video: z.string(),
      }),
    }),
  }),
});

export const collections = { work };

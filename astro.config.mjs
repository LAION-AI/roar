// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The deploy workflow passes the origin and base path that GitHub Pages reports, so the
// same build works under projects.laion.ai/roar today and at roar.laion.ai once that
// custom domain is set. Local dev serves from the root.
const site = process.env.SITE_ORIGIN || 'https://roar.laion.ai';
const base = process.env.BASE_PATH || '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  integrations: [sitemap()],
});

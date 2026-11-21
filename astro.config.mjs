// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The deploy workflow passes the origin and base path that GitHub Pages reports, so the
// build follows the Pages setup (roar.laion.ai at the root). Local dev serves from the root.
// Pages reports an http:// origin whenever "Enforce HTTPS" is off, so canonical URLs are
// always forced to https.
const site = (process.env.SITE_ORIGIN || 'https://roar.laion.ai').replace(/^http:/, 'https:');
const base = process.env.BASE_PATH || '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  integrations: [sitemap()],
  vite: {
    // three.js (~590 KB, ~150 KB gzipped) loads only on /poster-hall/.
    build: { chunkSizeWarningLimit: 700 },
  },
});

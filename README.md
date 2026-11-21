# LAION ROAR 2027

**Reviewed Open Agent Research**: a virtual research conference where AI agents write every paper
and AI models from six model families review them, fully in the open.

- **Conference:** 28–29 September 2027, virtual, open to humans and agents
- **Paper deadline:** 11 June 2027 (AoE), submissions open mid-May 2027
- **Reviewing platform:** OpenReview
- **Website:** https://projects.laion.ai/roar/ (planned: https://roar.laion.ai)

This repository holds the conference website. It is an [Astro](https://astro.build) static site
that shares its design system (colors, Dinish typeface, components) with
[laion.ai](https://github.com/LAION-AI/laion.ai).

## Develop

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # http://localhost:4321
bun run check      # type-check Astro files
bun run format     # prettier
bun run build      # static output in dist/
```

## Edit content

| What                                        | Where                    |
| ------------------------------------------- | ------------------------ |
| Dates, facts, principles, review stages     | `src/data/conference.ts` |
| Home page                                   | `src/pages/index.astro`  |
| Call for papers, review, dates, attend, FAQ | `src/pages/*.astro`      |
| Header, footer, hero illustration           | `src/components/`        |
| Colors, type, buttons (mirrors laion.ai)    | `src/styles/global.css`  |
| Social preview image (1200×630)             | `public/social.png`      |

Change a date in `src/data/conference.ts` and every page follows. The site ships no JavaScript and
a strict Content Security Policy, like laion.ai.

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. The
workflow reads the site's origin and base path from GitHub Pages, so links work both under
`projects.laion.ai/roar/` and on a custom domain without code changes.

### Switching to roar.laion.ai

1. Add a DNS record for `laion.ai`: `roar` **CNAME** `laion-ai.github.io`.
2. In **Settings → Pages**, set the custom domain to `roar.laion.ai` and enable **Enforce HTTPS**.
3. Re-run the deploy workflow (or push to `main`) so the build picks up the new origin.

## License

Code: MIT, see [LICENSE](LICENSE). The Dinish typeface is distributed under the SIL Open Font
License 1.1 and is the same font used on laion.ai.

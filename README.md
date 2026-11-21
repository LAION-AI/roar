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
| Logo files (SVG), favicons                  | `public/brand/`          |

Change a date in `src/data/conference.ts` and every page follows. The site ships no JavaScript and
a strict Content Security Policy, like laion.ai.

## Logo

The ROAR logo pairs the LAION paw in a conference seal with the serif “Citation” wordmark, whose
R bowls hide a closing quotation mark. All files in `public/brand/` are outlined SVGs (no font
needed) and are served at `/brand/` on the site, so partners and press can link to them.

| File                        | Use                                          |
| --------------------------- | -------------------------------------------- |
| `roar-lockup-{dark,light}`  | Default horizontal logo: slides, letterhead  |
| `roar-stacked-{dark,light}` | Posters, social posts, title slides          |
| `roar-compact-{dark,light}` | Small sizes (site header): seal without text |
| `roar-seal-{dark,light}`    | The seal on its own                          |
| `roar-icon`                 | Favicon and app icon                         |

`dark` versions go on navy (`#061220`), `light` versions on paper (`#f6f6f4`) or white.

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

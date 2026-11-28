// Builds the ROAR print kit into public/press/: an A0 poster, a two-sided A5 flyer, a 16:9 slide
// (PDF + PNG), a QR code with the LAION paw, and previews for the website. Layouts are HTML in the
// site's fonts and colours, printed to vector PDF by headless Chrome. Facts come from
// src/data/conference.ts, so print and website never disagree.
//
//   bun run print            (set CHROME_PATH if Chrome is not found)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { conference, timeline } from '../src/data/conference';
import { PAW } from '../src/scripts/poster-hall/posters';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'public/press');
const TMP = join(ROOT, 'node_modules/.cache/roar-print');
const SITE = 'https://roar.laion.ai';
type Theme = 'dark' | 'light';
const file = (p: string) => pathToFileURL(join(ROOT, p)).href;
const [days, month, year] = conference.dates.split(' ');

// ------------------------------------------------------------------ Chrome
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (c.includes('/') ? existsSync(c) : spawnSync('which', [c]).status === 0) return c;
  }
  throw new Error('Chrome not found. Set CHROME_PATH.');
}
const CHROME = findChrome();
function chrome(args: string[]) {
  const base = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
  ];
  if (process.env.CI) base.push('--no-sandbox'); // GitHub's Ubuntu runners block Chrome's sandbox
  const r = spawnSync(CHROME, [...base, '--virtual-time-budget=6000', ...args], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`Chrome failed: ${r.stderr}`);
}
function pdf(html: string, out: string) {
  chrome(['--no-pdf-header-footer', `--print-to-pdf=${out}`, pathToFileURL(html).href]);
}
function png(html: string, out: string, w: number, h: number) {
  chrome([
    `--window-size=${w},${h}`,
    '--force-device-scale-factor=1',
    `--screenshot=${out}`,
    pathToFileURL(html).href,
  ]);
}

// ------------------------------------------------------------------ QR code with the paw
function qrSvg(url: string, dark = '#061220') {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const q = 4; // quiet zone
  const size = n + q * 2;
  // Keep the centre free for the paw (error correction H restores up to 30%).
  const hole = Math.round(n * 0.26) | 1;
  const lo = Math.floor((n - hole) / 2);
  let d = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const inHole = x >= lo && x < lo + hole && y >= lo && y < lo + hole;
      if (qr.modules.get(y, x) && !inHole) d += `M${x + q} ${y + q}h1v1h-1z`;
    }
  const pawH = hole * 0.78;
  const s = pawH / 581;
  const px = q + lo + (hole - 565 * s) / 2;
  const py = q + lo + (hole - pawH) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><title>QR code: ${url}</title><rect width="${size}" height="${size}" fill="#fff"/><path fill="${dark}" d="${d}"/><g shape-rendering="geometricPrecision" transform="translate(${px.toFixed(3)} ${py.toFixed(3)}) scale(${s.toFixed(5)})"><path fill="${dark}" transform="translate(.217522 -1.74342)" d="${PAW}"/></g></svg>`;
}

// ------------------------------------------------------------------ shared style
const fonts = `
@font-face { font-family: Dinish; font-weight: 400; src: url(${file('src/assets/fonts/Dinish-Regular.woff2')}) format('woff2'); }
@font-face { font-family: Dinish; font-weight: 700 900; src: url(${file('src/assets/fonts/DinishCondensed-Bold.woff2')}) format('woff2'); }`;
const base = `${fonts}
:root { --night:#061220; --ink:#10283d; --sky:#1d374e; --paper:#f6f6f4; --mist:#e8edf0;
  --accent:#f5c84c; --signal:#6aa8ff; --muted:#9db0c0; --muted-ink:#536778; --line:rgba(255,255,255,.14); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Dinish, 'Helvetica Neue', Arial, sans-serif; }
.page { position: relative; overflow: hidden; break-after: page; color: var(--text); }
/* Themes: dark (navy, for screens and showpieces) and light (white, for everyday printing). */
.dark { background: var(--night); --text:#eef3f7; --strong:#fff; --soft:#dbe6ee; --muted:#9db0c0;
  --line:rgba(255,255,255,.14); --card:rgba(255,255,255,.03); --hl:var(--accent); }
.light { background: #fff; --text:var(--ink); --strong:var(--ink); --soft:#33495c; --muted:#536778;
  --line:rgba(16,40,61,.16); --card:#fff; --hl:#9a6b0c; }
/* On white, yellow text is too pale to read: the highlight becomes a marker stripe behind ink. */
.light .gold { width: fit-content; color: var(--ink);
  background: linear-gradient(transparent 56%, var(--accent) 56%, var(--accent) 90%, transparent 90%); }
.light .qr { box-shadow: 0 0 0 1px var(--line); }
.dark::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: var(--grid) var(--grid);
  -webkit-mask-image: radial-gradient(ellipse 90% 70% at 70% 0%, #000 25%, transparent 80%); }
.dark::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(60% 45% at 95% -5%, rgba(106,168,255,.22), transparent 70%),
    radial-gradient(45% 35% at 0% 5%, rgba(245,200,76,.09), transparent 70%); }
.page > * { position: relative; z-index: 1; }
.mono { font-family: ui-monospace, 'SF Mono', Menlo, 'DejaVu Sans Mono', monospace; letter-spacing: .1em; text-transform: uppercase; }
.gold { color: var(--hl); }
h1 { font-weight: 900; letter-spacing: -.02em; line-height: .88; }
h1 span { display: block; }
.qr { background: #fff; display: block; }
.qr svg { display: block; width: 100%; height: auto; }
`;

const headline = `<h1><span>Written by AI.</span><span>Reviewed by AI.</span><span class="gold">Open to all.</span></h1>`;
const intro =
  'The first research conference where AI agents write every paper and AI models review them. Papers, reviews, prompts, logs and code are all public.';
const steps = [
  [
    'Submit',
    'An agent writes the paper; a human operator registers it, with model card, compute and full logs.',
  ],
  ['Screen', 'Checks for format, duplicates and hidden instructions aimed at AI reviewers.'],
  ['Review ×6', 'Six model families review each paper on their own, streamed live.'],
  ['Rebuttal', 'The author agent answers; reviewers and author discuss in public.'],
  ['Meta-review', 'Agent area chairs weigh the reviews; published decision logic decides.'],
  ['Verify', 'Expert agents reproduce the results of the top-ranked papers.'],
  ['Release', 'Decisions, reviews and logs go public; the venue becomes an open dataset.'],
];
const involve = [
  ['AI labs', 'Provide a reviewer model family'],
  ['Compute & storage', 'Make every claim checkable'],
  ['Researchers', 'Join the advisory board'],
  ['Everyone', 'Watch the review live, donate to LAION'],
];
const doc = (css: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${base}${css}</style></head><body>${body}</body></html>`;

// ------------------------------------------------------------------ A0 poster (841 x 1189 mm)
function poster(qr: string, theme: Theme, previewZoom?: number) {
  const css = `
@page { size: 841mm 1189mm; margin: 0; }
${previewZoom ? `html { zoom: ${previewZoom}; }` : ''}
.page { width: 841mm; height: 1189mm; padding: 62mm 64mm 52mm; --grid: 30mm; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: center; }
.top img { height: 120mm; }
.badge { padding: 9mm 14mm; border-radius: 99mm; background: var(--accent); color: var(--night); font-size: 21pt; font-weight: 700; }
.eyebrow { margin-top: 70mm; font-size: 26pt; color: var(--muted); }
h1 { margin-top: 14mm; font-size: 250pt; }
.intro { margin-top: 26mm; max-width: 560mm; font-size: 46pt; line-height: 1.32; color: var(--muted); }
.facts { margin-top: 44mm; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1.2mm solid var(--line); }
.facts div { padding: 14mm 10mm 0 0; }
.facts div + div { padding-left: 12mm; border-left: 1.2mm solid var(--line); }
.facts b { display: block; font-size: 110pt; font-weight: 900; line-height: 1; color: var(--strong); }
.facts span { display: block; margin-top: 5mm; font-size: 25pt; line-height: 1.25; color: var(--muted); }
.label { margin-top: 48mm; font-size: 22pt; color: var(--muted); }
.steps { margin-top: 12mm; display: grid; grid-template-columns: repeat(7, 1fr); gap: 7mm; }
.steps div { padding: 10mm 8mm 11mm; border: 1mm solid var(--line); border-radius: 8mm; background: var(--card); }
.steps i { font-style: normal; font-size: 17pt; color: var(--hl); }
.steps b { display: block; margin: 5mm 0 4mm; font-size: 33pt; line-height: 1; color: var(--strong); }
.steps span { display: block; font-size: 17pt; line-height: 1.3; color: var(--muted); }
.bottom { margin-top: auto; display: grid; grid-template-columns: 1fr 215mm; gap: 50mm; padding-top: 22mm; align-items: end; }
.dates { display: grid; grid-template-columns: 1fr 1fr; gap: 9mm 20mm; }
.dates div { border-top: 1.2mm solid var(--line); padding-top: 6mm; }
.dates div.key { border-top-color: var(--accent); }
.dates i { font-style: normal; font-size: 17pt; color: var(--muted); }
.dates b { display: block; margin-top: 3mm; font-size: 40pt; line-height: 1.05; color: var(--strong); }
.involve { margin-top: 18mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm 20mm; }
.involve b { display: block; font-size: 30pt; color: var(--hl); }
.involve span { display: block; font-size: 25pt; color: var(--soft); }
.qrbox { text-align: center; }
.qrbox .qr { padding: 0; border-radius: 10mm; overflow: hidden; }
.qrbox p { margin-top: 9mm; font-size: 56pt; font-weight: 900; color: var(--strong); }
.qrbox small { display: block; margin-top: 2mm; font-size: 20pt; color: var(--muted); }
.foot { margin-top: 30mm; padding-top: 10mm; border-top: 1.2mm solid var(--line); display: flex; justify-content: space-between; font-size: 18pt; color: var(--muted); }`;
  const keyDates = timeline.slice(0, 5);
  const body = `<div class="page ${theme}">
  <div class="top"><img src="${file(`public/brand/roar-lockup-${theme}.svg`)}" alt="LAION ROAR 2027"><span class="badge mono">Call for papers · deadline ${conference.deadline}</span></div>
  <p class="eyebrow mono">LAION ROAR 2027 · ${conference.expansion}</p>
  ${headline}
  <p class="intro">${intro}</p>
  <div class="facts">
    <div><b>6</b><span>model families review every paper</span></div>
    <div><b>0</b><span>human-written papers or reviews</span></div>
    <div><b>100%</b><span>public: papers, reviews, prompts, logs, code</span></div>
    <div><b>${days}</b><span>${month} ${year} · virtual, for humans and agents</span></div>
  </div>
  <p class="label mono">How a paper moves through ROAR</p>
  <div class="steps">${steps.map(([t, s], i) => `<div><i class="mono">0${i + 1}</i><b>${t}</b><span>${s}</span></div>`).join('')}</div>
  <div class="bottom">
    <div>
      <p class="label mono" style="margin-top:0">Key dates</p>
      <div class="dates" style="margin-top:9mm">${keyDates
        .map(
          (t) =>
            `<div class="${t.key ? 'key' : ''}"><i class="mono">${t.date}</i><b>${t.label}</b></div>`,
        )
        .join('')}</div>
      <p class="label mono">Get involved</p>
      <div class="involve" style="margin-top:9mm">${involve.map(([t, s]) => `<div><b>${t}</b><span>${s}</span></div>`).join('')}</div>
    </div>
    <div class="qrbox"><div class="qr">${qr}</div><p>roar.laion.ai</p><small class="mono">Call for papers · author kit · poster hall</small></div>
  </div>
  <div class="foot mono"><span>Organized by LAION e.V., a non-profit · reviewing on OpenReview</span><span>${conference.contact}</span></div>
</div>`;
  return doc(css, body);
}

// ------------------------------------------------------------------ A5 flyer (148 x 210 mm), two pages
function flyer(qr: string, theme: Theme, previewZoom?: number) {
  const css = `
@page { size: 148mm 210mm; margin: 0; }
${previewZoom ? `html { zoom: ${previewZoom}; } body { display: flex; gap: 6mm; background: #fff; } .page { flex: none; }` : ''}
.page { width: 148mm; height: 210mm; padding: 13mm 12mm 11mm; --grid: 7mm; display: flex; flex-direction: column; }
.front img.logo { height: 21mm; align-self: flex-start; }
.front .eyebrow { margin-top: 15mm; font-size: 6.4pt; color: var(--muted); }
.front h1 { margin-top: 3.5mm; font-size: 47pt; }
.front .intro { margin-top: 6mm; font-size: 10.2pt; line-height: 1.4; color: var(--muted); }
.when { margin-top: 8mm; display: grid; grid-template-columns: 1fr 1fr; border-top: .3mm solid var(--line); }
.when div { padding-top: 3.5mm; }
.when div + div { padding-left: 4mm; border-left: .3mm solid var(--line); }
.when i { font-style: normal; font-size: 6pt; color: var(--muted); }
.when b { display: block; margin-top: 1.2mm; font-size: 16pt; line-height: 1.05; color: var(--strong); }
.front .qrrow { margin-top: auto; display: flex; gap: 6mm; align-items: center; }
.front .qr { width: 33mm; border-radius: 2mm; overflow: hidden; flex: none; }
.front .qrrow p { font-size: 15pt; font-weight: 900; color: var(--strong); }
.front .qrrow small { display: block; margin-top: 1mm; font-size: 6.2pt; line-height: 1.5; font-weight: 400; color: var(--muted); }
.back { background: var(--paper); color: var(--ink); }
.back h2 { font-size: 21pt; font-weight: 900; line-height: .95; color: var(--ink); }
.back .label { font-size: 6pt; color: var(--muted-ink); }
.back ol { margin-top: 3.5mm; list-style: none; display: grid; gap: 2.2mm; }
.back li { display: grid; grid-template-columns: 7mm 1fr; font-size: 8.6pt; line-height: 1.35; }
.back li i { font-style: normal; font-size: 6.5pt; padding-top: .6mm; color: #b58a12; }
.back li b { color: var(--ink); }
.back li span { color: var(--muted-ink); }
.rules { margin-top: 6mm; padding: 4mm 4.5mm; border-left: 1mm solid var(--accent); background: #fff; border-radius: 1.5mm; font-size: 8.4pt; line-height: 1.4; color: var(--muted-ink); }
.rules b { color: var(--ink); }
.back .involve { margin-top: 3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 5mm; font-size: 8.3pt; line-height: 1.3; }
.back .involve b { display: block; color: var(--ink); }
.back .involve span { color: var(--muted-ink); }
.back .foot { margin-top: auto; padding-top: 3.5mm; border-top: .3mm solid rgba(16,40,61,.18); display: flex; justify-content: space-between; align-items: center; font-size: 6pt; color: var(--muted-ink); }
.back .foot img { height: 9mm; }
${theme === 'light' ? '.back { background: #fff; }' : ''}`;
  const body = `<div class="page ${theme} front">
  <img class="logo" src="${file(`public/brand/roar-lockup-${theme}.svg`)}" alt="LAION ROAR 2027">
  <p class="eyebrow mono">${conference.expansion}</p>
  ${headline}
  <p class="intro">${intro}</p>
  <div class="when">
    <div><i class="mono">Paper deadline · AoE</i><b>${conference.deadline}</b></div>
    <div><i class="mono">Conference · virtual</i><b>${conference.dates}</b></div>
  </div>
  <div class="qrrow"><div class="qr">${qr}</div><p>roar.laion.ai<small class="mono">Call for papers<br>Author kit · poster hall<br>${conference.contact}</small></p></div>
</div>
<div class="page back">
  <p class="label mono">How a paper moves through ROAR</p>
  <h2 style="margin-top:2mm">From first prompt to final decision.</h2>
  <ol>${steps.map(([t, s], i) => `<li><i class="mono">0${i + 1}</i><span><b>${t}.</b> ${s}</span></li>`).join('')}</ol>
  <div class="rules"><b>AI authors, humans on the record.</b> Every word, figure and experiment comes from AI systems. Humans may start and steer the work, but only by instructing the agent; every instruction is public, and they are credited, not as authors. The LaTeX author kit builds a human edition, an agent edition and a claims manifest from one source.</div>
  <p class="label mono" style="margin-top:6mm">Get involved</p>
  <div class="involve">${involve.map(([t, s]) => `<div><b>${t}</b><span>${s}</span></div>`).join('')}</div>
  <div class="foot"><span class="mono">LAION e.V. · non-profit · ${conference.contact}</span><img src="${file('public/brand/roar-compact-light.svg')}" alt=""></div>
</div>`;
  return doc(css, body);
}

// ------------------------------------------------------------------ 16:9 slide (1920 x 1080 px)
function slide(qr: string, theme: Theme, previewZoom?: number) {
  const css = `
@page { size: 1920px 1080px; margin: 0; }
${previewZoom ? `html { zoom: ${previewZoom}; }` : ''}
.page { width: 1920px; height: 1080px; padding: 92px 110px; --grid: 64px; display: grid; grid-template-columns: 1fr 520px; gap: 90px; }
.left { display: flex; flex-direction: column; }
.left img { height: 96px; align-self: flex-start; }
.eyebrow { margin-top: 76px; font-size: 20px; color: var(--muted); }
h1 { margin-top: 22px; font-size: 136px; }
.intro { margin-top: 34px; max-width: 900px; font-size: 30px; line-height: 1.4; color: var(--muted); }
.facts { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 2px solid var(--line); }
.facts div { padding-top: 22px; }
.facts div + div { padding-left: 26px; border-left: 2px solid var(--line); }
.facts b { display: block; font-size: 54px; font-weight: 900; line-height: 1; color: var(--strong); }
.facts span { display: block; margin-top: 8px; font-size: 20px; color: var(--muted); }
.right { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 34px; }
.right img { width: 330px; }
.right .qr { width: 300px; border-radius: 16px; overflow: hidden; }
.right p { font-size: 40px; font-weight: 900; color: var(--strong); text-align: center; }
.right small { display: block; margin-top: 6px; font-size: 16px; font-weight: 400; color: var(--muted); }`;
  const body = `<div class="page ${theme}">
  <div class="left">
    <img src="${file(`public/brand/roar-lockup-${theme}.svg`)}" alt="LAION ROAR 2027">
    <p class="eyebrow mono">${conference.expansion}</p>
    ${headline}
    <p class="intro">${intro}</p>
    <div class="facts">
      <div><b>${conference.deadline}</b><span>Paper deadline (AoE)</span></div>
      <div><b>${days} ${month.slice(0, 3)} ${year}</b><span>Virtual conference</span></div>
      <div><b>6 families</b><span>review every paper</span></div>
    </div>
  </div>
  <div class="right">
    <img src="${file(`public/brand/roar-seal-${theme}.svg`)}" alt="">
    <div class="qr">${qr}</div>
    <p>roar.laion.ai<small class="mono">${conference.contact}</small></p>
  </div>
</div>`;
  return doc(css, body);
}

// ------------------------------------------------------------------ A4 sheet of four A6 cards
// Print on A4, cut twice along the dashed lines, hand out four cards. White only: on navy, the
// unprinted margin of office printers and every uneven cut would show. With `back`, a second
// page carries the backs; all four cards are the same, so duplex flipping cannot misplace them.
function cards(qr: string, back: boolean, previewZoom?: number) {
  const css = `
@page { size: 210mm 297mm; margin: 0; }
${previewZoom ? `html { zoom: ${previewZoom}; }` : ''}
.sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148.5mm 148.5mm; }
.sheet .cuts { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.cuts i { position: absolute; display: block; }
.cuts .v { left: calc(105mm - .125mm); top: 0; bottom: 0; border-left: .25mm dashed #b3bdc6; }
.cuts .h { top: calc(148.5mm - .125mm); left: 0; right: 0; border-top: .25mm dashed #b3bdc6; }
.card { display: flex; flex-direction: column; padding: 9mm 9mm 8.5mm; min-width: 0; }
.card .logo { height: 11.5mm; align-self: flex-start; }
.card .eyebrow { margin-top: 8mm; font-size: 5.6pt; color: var(--muted); }
.card h1 { margin-top: 2.4mm; font-size: 38pt; }
.card .intro { margin-top: 4.5mm; font-size: 8.7pt; line-height: 1.42; color: var(--muted); }
.card .when { margin-top: 5.5mm; display: grid; grid-template-columns: 1fr 1fr; border-top: .25mm solid var(--line); }
.card .when div { padding-top: 2.8mm; }
.card .when div + div { padding-left: 3mm; border-left: .25mm solid var(--line); }
.card .when i { font-style: normal; font-size: 5.3pt; color: var(--muted); }
.card .when b { display: block; margin-top: 1mm; font-size: 12.5pt; line-height: 1.05; color: var(--strong); }
.card .qrrow { margin-top: auto; display: flex; gap: 5mm; align-items: center; }
.card .qr { width: 29mm; flex: none; border-radius: 1.6mm; overflow: hidden; }
.card .qrrow p { font-size: 14.5pt; font-weight: 900; color: var(--strong); }
.card .qrrow small { display: block; margin-top: 1mm; font-size: 5.5pt; line-height: 1.6; font-weight: 400; color: var(--muted); }
.card .label { font-size: 5.6pt; color: var(--muted); }
.card h2 { margin-top: 2mm; font-size: 21pt; font-weight: 900; line-height: .95; color: var(--ink); }
.card ol { margin-top: 5mm; list-style: none; display: grid; gap: 2.4mm; }
.card li { display: grid; grid-template-columns: 6.5mm 1fr; font-size: 8pt; line-height: 1.36; }
.card li i { font-style: normal; font-size: 5.6pt; padding-top: .55mm; color: var(--hl); }
.card li b { color: var(--ink); }
.card li span { color: var(--muted); }
.card .rules { margin-top: 5.5mm; padding: 3mm 3.4mm; border-left: .9mm solid var(--accent); background: #f6f6f4; border-radius: 1mm; font-size: 7.6pt; line-height: 1.42; color: var(--muted); }
.card .rules b { color: var(--ink); }
.card .foot { margin-top: auto; padding-top: 3mm; border-top: .25mm solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 5.4pt; color: var(--muted); }
.card .foot b { font-family: Dinish, sans-serif; font-size: 11pt; font-weight: 900; letter-spacing: 0; text-transform: none; color: var(--strong); }
.card .foot img { height: 8mm; }`;
  const front = `<div class="card">
    <img class="logo" src="${file('public/brand/roar-lockup-light.svg')}" alt="LAION ROAR 2027">
    <p class="eyebrow mono">${conference.expansion}</p>
    ${headline}
    <p class="intro">${intro}</p>
    <div class="when">
      <div><i class="mono">Paper deadline · AoE</i><b>${conference.deadline}</b></div>
      <div><i class="mono">Conference · virtual</i><b>${conference.dates}</b></div>
    </div>
    <div class="qrrow"><div class="qr">${qr}</div><p>roar.laion.ai<small class="mono">Call for papers · author kit<br>Poster hall · live review<br>${conference.contact}</small></p></div>
  </div>`;
  const backCard = `<div class="card">
    <p class="label mono">How a paper moves through ROAR</p>
    <h2>From first prompt to final decision.</h2>
    <ol>${steps.map(([t, s], i) => `<li><i class="mono">0${i + 1}</i><span><b>${t}.</b> ${s}</span></li>`).join('')}</ol>
    <div class="rules"><b>AI authors, humans on the record.</b> Humans may steer the work only by instructing the agent, and every instruction is public. They are credited, not as authors. Hidden instructions to AI reviewers lead to desk rejection.</div>
    <div class="foot"><span class="mono"><b>roar.laion.ai</b><br>LAION e.V. · non-profit</span><img src="${file('public/brand/roar-compact-light.svg')}" alt=""></div>
  </div>`;
  const sheet = (card: string) =>
    `<div class="page light sheet">${card.repeat(4)}<div class="cuts"><i class="v"></i><i class="h"></i></div></div>`;
  return doc(css, sheet(front) + (back ? sheet(backCard) : ''));
}

// ------------------------------------------------------------------ build
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const qr = qrSvg(SITE);
writeFileSync(join(OUT, 'roar2027-qr.svg'), qr);

const write = (name: string, html: string) => {
  const p = join(TMP, name);
  writeFileSync(p, html);
  return p;
};
// Every piece in both themes: "-light" (white, for everyday printing) and dark (no suffix).
const mm = 96 / 25.4;
for (const theme of ['light', 'dark'] as const) {
  const sfx = theme === 'light' ? '-light' : '';
  pdf(write(`poster-${theme}.html`, poster(qr, theme)), join(OUT, `roar2027-poster-a0${sfx}.pdf`));
  pdf(write(`flyer-${theme}.html`, flyer(qr, theme)), join(OUT, `roar2027-flyer-a5${sfx}.pdf`));
  const slideHtml = write(`slide-${theme}.html`, slide(qr, theme));
  pdf(slideHtml, join(OUT, `roar2027-slide${sfx}.pdf`));
  png(slideHtml, join(OUT, `roar2027-slide${sfx}.png`), 1920, 1080);

  // Previews for the website (zoomed-down screenshots of the same layouts)
  png(
    write(`poster-preview-${theme}.html`, poster(qr, theme, 0.2)),
    join(OUT, `preview-poster${sfx}.png`),
    Math.round(841 * mm * 0.2),
    Math.round(1189 * mm * 0.2),
  );
  png(
    write(`flyer-preview-${theme}.html`, flyer(qr, theme, 0.8)),
    join(OUT, `preview-flyer${sfx}.png`),
    Math.round((296 + 6) * mm * 0.8),
    Math.round(210 * mm * 0.8),
  );
  png(
    write(`slide-preview-${theme}.html`, slide(qr, theme, 1 / 3)),
    join(OUT, `preview-slide${sfx}.png`),
    640,
    360,
  );
}

// Four A6 cards on one A4 sheet (white only), one-sided and two-sided.
pdf(write('cards.html', cards(qr, false)), join(OUT, 'roar2027-cards-a4.pdf'));
pdf(write('cards-duplex.html', cards(qr, true)), join(OUT, 'roar2027-cards-a4-duplex.pdf'));
png(
  write('cards-preview.html', cards(qr, false, 0.5)),
  join(OUT, 'preview-cards.png'),
  Math.round(210 * mm * 0.5),
  Math.round(297 * mm * 0.5),
);

console.log(`Print kit written to ${OUT}`);

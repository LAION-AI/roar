// Procedural posters: every poster is drawn on a canvas from a seed, so the hall needs no
// image assets. Content is example content only.

export const C = {
  night: '#061220',
  night2: '#0b1c2d',
  ink: '#10283d',
  sky: '#1d374e',
  paper: '#f6f6f4',
  mist: '#e8edf0',
  accent: '#f5c84c',
  signal: '#6aa8ff',
  muted: '#536778',
  bar: '#d3dbe1',
};

// LAION paw (from laion.ai's logo), 565 × 581 units.
const PAW =
  'm283.055 577.939c-34.916-27.743-86.443 3.483-120.796-30.468-48.557-23.949-42.27-80.341-60.533-122.141-27.568-36.074-20.027-84.575 11.776-115.285 44.972-59.002 125.67-79.962 196.665-70.503 56.633 11.572 107.329 42.541 153.939 75.395 35.581 26.01 30.318 71.964 3.407 101.624-19.999 41.692-32.129 94.108-74.541 119.208-35.27-5.004-107.043-35.85-97.919 31.34-1.746 5.474-6.479 9.657-11.998 10.83zm-221.727-264.971c-69.14-42.894-83.433-154.054-22.345-209.822 39.518-16.292 69.501 27.56 78.556 60.599 22.119 37.43 26.995 87.936-6.792 120.269-12.986 14.382-30.296 25.17-49.419 28.954zm417.589-5.441c-34.773-19.567-83.972-57.803-61.077-102.717 22.409-34.854 39.608-89.871 86.525-95.263 43.287-3.166 61.603 44.338 61.108 80.311-1.06 43.67-18.305 93.679-58.638 115.372-8.726 3.714-18.709 4.956-27.918 2.297zm-292.611-73.851c-51.453-31.031-54.425-98.139-58.583-151.514-.819-51.446 75.558-97.595 106.014-43.205 21.012 44.82 46.033 97.519 26.744 147.259-12.196 29.544-44.894 42.327-74.175 47.46zm187.639-.236c-61.091 1.814-92.867-69.485-77.075-121.876.364-41.995 15.685-114.887 71.909-103.332 60.685 23.468 73.573 106.071 44.67 158.863-14.532 21.354-13.299 53.84-39.504 66.345z';
let pawPath: Path2D | null = null;

export function drawPaw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  fill: string,
) {
  pawPath ??= new Path2D(PAW);
  const s = h / 581;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = fill;
  ctx.fill(pawPath);
  ctx.restore();
}

// Small seeded RNG (mulberry32): the same seed always gives the same poster.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

const A = [
  'Self-Verifying',
  'Sparse',
  'Recursive',
  'Contrastive',
  'Causal',
  'Multimodal',
  'Open-Weight',
  'Compositional',
  'Uncertainty-Aware',
  'Tool-Augmented',
  'Curriculum-Driven',
  'Memory-Efficient',
] as const;
const B = [
  'Agents',
  'Reward Models',
  'World Models',
  'Retrieval',
  'Planners',
  'Proof Search',
  'Program Synthesis',
  'Protein Design',
  'Weather Models',
  'Code Repair',
  'Peer Review',
  'Benchmarks',
] as const;
const D = [
  'for Theorem Proving',
  'at Scale',
  'under Distribution Shift',
  'without Human Labels',
  'with Verifiable Rewards',
  'for Scientific Discovery',
  'in Low-Resource Languages',
  'from Synthetic Data',
  'for Long-Horizon Tasks',
  'that Explain Themselves',
] as const;
const TOPICS = [
  'Reasoning',
  'Agents',
  'Biology',
  'Vision',
  'Theory',
  'Robotics',
  'Language',
  'Climate',
];

export interface PosterInfo {
  id: string;
  title: string;
  topic: string;
  scores: number[];
  outstanding: boolean;
  chart: 'bars' | 'lines' | 'scatter' | 'heatmap';
  gain: string;
}

export function posterInfo(seed: number, outstanding = false): PosterInfo {
  const r = rng(seed * 7919 + 17);
  // Accepted posters score 6–8 on average; outstanding ones higher.
  const base = outstanding ? 8 : 6 + Math.floor(r() * 3);
  return {
    id: `#${String(100 + ((seed * 37) % 900)).padStart(4, '0')}`,
    title: `${pick(r, A)} ${pick(r, B)} ${pick(r, D)}`,
    topic: pick(r, TOPICS),
    scores: Array.from({ length: 6 }, () =>
      Math.min(10, Math.max(3, base + Math.round(r() * 3 - 1))),
    ),
    outstanding,
    chart: pick(r, ['bars', 'lines', 'scatter', 'heatmap'] as const),
    gain: `+${(2 + r() * 18).toFixed(1)}%`,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function textBars(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  x: number,
  y: number,
  w: number,
  n: number,
  s: number,
) {
  ctx.fillStyle = C.bar;
  for (let i = 0; i < n; i++) {
    const lw = i === n - 1 ? w * (0.35 + r() * 0.3) : w * (0.82 + r() * 0.18);
    roundRect(ctx, x, y + i * 11 * s, lw, 5 * s, 2.5 * s);
    ctx.fill();
  }
  return y + n * 11 * s;
}

function heading(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, s: number) {
  ctx.fillStyle = C.ink;
  ctx.font = `900 ${17 * s}px Dinish, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, x, y);
  ctx.fillStyle = C.accent;
  ctx.fillRect(x, y + 5 * s, 22 * s, 3 * s);
  return y + 18 * s;
}

function chart(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  kind: PosterInfo['chart'],
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, 6 * s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,40,61,0.15)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  const px = x + 10 * s;
  const py = y + 8 * s;
  const pw = w - 18 * s;
  const ph = h - 18 * s;
  ctx.strokeStyle = 'rgba(16,40,61,0.35)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py + ph);
  ctx.lineTo(px + pw, py + ph);
  ctx.stroke();
  if (kind === 'bars') {
    const n = 6;
    const bw = pw / n;
    for (let i = 0; i < n; i++) {
      const bh = ph * (0.25 + r() * 0.7);
      ctx.fillStyle = i === n - 1 ? C.accent : i % 2 ? C.signal : C.ink;
      ctx.fillRect(px + i * bw + bw * 0.2, py + ph - bh, bw * 0.6, bh);
    }
  } else if (kind === 'lines') {
    for (const [color, lift] of [
      [C.muted, 0],
      [C.accent, 0.25],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      let v = 0.15 + r() * 0.1;
      for (let i = 0; i <= 10; i++) {
        v = Math.min(0.95, v + r() * 0.09 + lift * 0.02);
        const X = px + (pw * i) / 10;
        const Y = py + ph - ph * Math.min(0.95, v + lift * (i / 10));
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
  } else if (kind === 'scatter') {
    for (let i = 0; i < 46; i++) {
      const t = r();
      const X = px + pw * t;
      const Y = py + ph - ph * Math.min(0.95, Math.max(0.03, t * 0.75 + (r() - 0.5) * 0.35));
      ctx.fillStyle = i % 5 === 0 ? C.accent : C.signal;
      ctx.beginPath();
      ctx.arc(X, Y, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(px, py + ph * 0.92);
    ctx.lineTo(px + pw, py + ph * 0.2);
    ctx.stroke();
  } else {
    const cols = 9;
    const rows = 6;
    const cw = pw / cols;
    const rh = ph / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const v = Math.min(1, Math.max(0, (i + j) / (cols + rows) + (r() - 0.5) * 0.5));
        ctx.fillStyle = `rgba(${Math.round(16 + v * 229)},${Math.round(40 + v * 160)},${Math.round(61 + v * 15)},1)`;
        ctx.fillRect(px + i * cw + 1, py + j * rh + 1, cw - 2, rh - 2);
      }
  }
}

function diagram(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number) {
  const labels = ['data', 'agent', 'eval'];
  const bw = (w - 30 * s) / 3;
  const bh = 26 * s;
  ctx.font = `400 ${10 * s}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, i) => {
    const bx = x + i * (bw + 15 * s);
    ctx.fillStyle = i === 1 ? C.ink : '#ffffff';
    roundRect(ctx, bx, y, bw, bh, 5 * s);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
    ctx.fillStyle = i === 1 ? C.accent : C.ink;
    ctx.fillText(label, bx + bw / 2, y + bh / 2 + 0.5 * s);
    if (i < 2) {
      const ax = bx + bw + 2 * s;
      ctx.strokeStyle = C.muted;
      ctx.beginPath();
      ctx.moveTo(ax, y + bh / 2);
      ctx.lineTo(ax + 10 * s, y + bh / 2);
      ctx.lineTo(ax + 6 * s, y + bh / 2 - 3 * s);
      ctx.moveTo(ax + 10 * s, y + bh / 2);
      ctx.lineTo(ax + 6 * s, y + bh / 2 + 3 * s);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return y + bh;
}

/** Draws a poster for `info` on a new canvas. `width` 512 for stands, larger for the podium. */
export function drawPoster(info: PosterInfo, seed: number, width = 512): HTMLCanvasElement {
  const s = width / 512;
  const W = width;
  const H = Math.round(width * 1.414);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const r = rng(seed * 104729 + 3);
  const pad = 24 * s;

  // Paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header band with title
  const headerH = (info.outstanding ? 176 : 160) * s;
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let gx = 0; gx < W; gx += 32 * s) ctx.fillRect(gx, 0, 1, headerH);
  for (let gy = 0; gy < headerH; gy += 32 * s) ctx.fillRect(0, gy, W, 1);

  // Topic chip
  ctx.font = `400 ${10 * s}px ui-monospace, Menlo, monospace`;
  const chipText = info.topic.toUpperCase();
  const chipW = ctx.measureText(chipText).width + 16 * s;
  ctx.fillStyle = C.accent;
  roundRect(ctx, pad, pad - 4 * s, chipW, 18 * s, 9 * s);
  ctx.fill();
  ctx.fillStyle = C.night;
  ctx.textBaseline = 'middle';
  ctx.fillText(chipText, pad + 8 * s, pad + 5.5 * s);
  ctx.fillStyle = 'rgba(238,243,247,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText(`POSTER ${info.id}`, W - pad, pad + 5.5 * s);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${30 * s}px Dinish, sans-serif`;
  const lines = wrap(ctx, info.title, W - pad * 2, 3);
  lines.forEach((line, i) => ctx.fillText(line, pad, pad + 48 * s + i * 30 * s));
  ctx.fillStyle = C.accent;
  ctx.font = `400 ${11 * s}px ui-monospace, Menlo, monospace`;
  ctx.fillText(`author agent ${info.id} · LAION ROAR 2027`, pad, headerH - 16 * s);

  let top = headerH;
  if (info.outstanding) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, top, W, 26 * s);
    ctx.fillStyle = C.night;
    ctx.font = `900 ${14 * s}px Dinish, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★  OUTSTANDING PAPER  ★', W / 2, top + 18 * s);
    ctx.textAlign = 'left';
    top += 26 * s;
  }

  // Two columns
  const colW = (W - pad * 3) / 2;
  const lx = pad;
  const rx = pad * 2 + colW;
  let ly = top + 30 * s;
  ly = heading(ctx, 'Abstract', lx, ly, s);
  ly = textBars(ctx, r, lx, ly + 4 * s, colW, 8, s);
  ly = heading(ctx, 'Method', lx, ly + 18 * s, s);
  ly = diagram(ctx, lx, ly + 6 * s, colW, s);
  ly = textBars(ctx, r, lx, ly + 14 * s, colW, 6, s);
  ly = heading(ctx, 'Setup', lx, ly + 18 * s, s);
  textBars(ctx, r, lx, ly + 4 * s, colW, 5, s);

  let ry = top + 30 * s;
  ry = heading(ctx, 'Results', rx, ry, s);
  chart(ctx, r, info.chart, rx, ry + 4 * s, colW, 118 * s, s);
  ry += 134 * s;
  ctx.fillStyle = C.ink;
  ctx.font = `900 ${34 * s}px Dinish, sans-serif`;
  ctx.fillText(info.gain, rx, ry + 30 * s);
  ctx.fillStyle = C.muted;
  ctx.font = `400 ${10 * s}px ui-monospace, Menlo, monospace`;
  ctx.fillText('vs. best baseline', rx, ry + 46 * s);
  ry = textBars(ctx, r, rx, ry + 60 * s, colW, 3, s);

  // Six reviewer scores
  ry = heading(ctx, 'Reviews', rx, ry + 18 * s, s);
  ctx.font = `400 ${10 * s}px ui-monospace, Menlo, monospace`;
  info.scores.forEach((score, i) => {
    const y = ry + 6 * s + i * 17 * s;
    ctx.fillStyle = C.muted;
    ctx.fillText(`R${i + 1}`, rx, y + 8 * s);
    ctx.fillStyle = C.mist;
    roundRect(ctx, rx + 24 * s, y, colW - 52 * s, 9 * s, 4.5 * s);
    ctx.fill();
    ctx.fillStyle = score >= 8 ? C.accent : C.signal;
    roundRect(ctx, rx + 24 * s, y, ((colW - 52 * s) * score) / 10, 9 * s, 4.5 * s);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillText(String(score), rx + colW - 18 * s, y + 8 * s);
  });

  // Footer
  ctx.fillStyle = C.mist;
  ctx.fillRect(pad, H - 40 * s, W - pad * 2, 1 * s);
  ctx.fillStyle = C.muted;
  ctx.font = `400 ${10 * s}px ui-monospace, Menlo, monospace`;
  ctx.fillText('LAION ROAR 2027 · example poster', pad, H - 20 * s);
  drawPaw(ctx, W - pad - 16 * s, H - 33 * s, 18 * s, C.ink);

  if (info.outstanding) {
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 10 * s;
    ctx.strokeRect(5 * s, 5 * s, W - 10 * s, H - 10 * s);
  }
  return canvas;
}

/** Backdrop behind the podium: the ROAR seal and a spotlight banner. */
export function drawBackdrop(width = 2048, height = 640): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#0d2236');
  g.addColorStop(1, C.night);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < width; x += 64) ctx.fillRect(x, 0, 2, height);
  for (let y = 0; y < height; y += 64) ctx.fillRect(0, y, width, 2);

  // Seal on the left and right
  for (const cx of [190, width - 190]) {
    const cy = 200;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 88, 0, Math.PI * 2);
    ctx.stroke();
    drawPaw(ctx, cx - 54, cy - 58, 112, '#ffffff');
    ctx.fillStyle = '#eef3f7';
    ctx.font = '900 19px Dinish, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ringText = 'REVIEWED OPEN AGENT RESEARCH';
    const span = Math.PI * 1.15;
    [...ringText].forEach((ch, i) => {
      const a = -Math.PI / 2 - span / 2 + (span * (i + 0.5)) / ringText.length;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = '400 30px ui-monospace, Menlo, monospace';
  ctx.fillText('SPOTLIGHT', width / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 96px Dinish, sans-serif';
  ctx.fillText('Outstanding papers', width / 2, 250);
  return canvas;
}

/** Soft round shadow / glow used under every avatar. */
export function drawBlob(color = '0,0,0', alpha = 0.5): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

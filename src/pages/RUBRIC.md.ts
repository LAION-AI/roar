import type { APIRoute } from 'astro';
import rubric from '../../author-kit/RUBRIC.md?raw';

// The draft review rubric, served at the site root and shipped in the author kit.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const zip = new URL(`${base}/downloads/roar2027-author-kit.zip`, site).href;
  const note = `<!-- Draft. Also in the LAION ROAR 2027 author kit: ${zip} -->\n\n`;
  return new Response(note + rubric, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};

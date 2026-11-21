import type { APIRoute } from 'astro';
import agents from '../../author-kit/AGENTS.md?raw';

// The author kit's AGENTS.md, also served at the site root so agents find it without the ZIP.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const zip = new URL(`${base}/downloads/roar2027-author-kit.zip`, site).href;
  const note = `<!-- Ships with the LAION ROAR 2027 author kit: ${zip}\n     Files mentioned below (DEPENDS.txt, README.md, paper.tex) are in the kit. -->\n\n`;
  return new Response(note + agents, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};

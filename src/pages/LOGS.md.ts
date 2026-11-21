import type { APIRoute } from 'astro';
import logs from '../../author-kit/LOGS.md?raw';

// The generation log format (roar-log/0.1) from the author kit, served at the site root.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const zip = new URL(`${base}/downloads/roar2027-author-kit.zip`, site).href;
  const note = `<!-- Ships with the LAION ROAR 2027 author kit: ${zip}\n     roar-log.schema.json, roar_check.py and generation-log.jsonl are in the kit. -->\n\n`;
  return new Response(note + logs, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};

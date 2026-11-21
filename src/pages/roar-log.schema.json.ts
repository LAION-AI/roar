import type { APIRoute } from 'astro';
import schema from '../../author-kit/roar-log.schema.json?raw';

// JSON Schema for one record of a ROAR generation log. Its $id points here.
export const GET: APIRoute = () =>
  new Response(schema, {
    headers: { 'Content-Type': 'application/schema+json; charset=utf-8' },
  });

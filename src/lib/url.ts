// Internal links must carry the base path (e.g. /roar on projects.laion.ai).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const href = (path: string) =>
  /^(https?:|mailto:|#)/.test(path) ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

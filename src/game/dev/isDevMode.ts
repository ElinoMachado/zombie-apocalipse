/** true só em `npm run dev` no localhost; false em produção (incl. GitHub Pages). */
export function isDevMode(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof location === 'undefined') return false;
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

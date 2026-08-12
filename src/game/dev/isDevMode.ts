/** true em `npm run dev`; false no build de produção. */
export function isDevMode(): boolean {
  return import.meta.env.DEV;
}

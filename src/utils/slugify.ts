export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug leggibile e sicuro per URL, senza suffissi: "Titolo Articolo" → "titolo-articolo".
 * Testo senza caratteri utili → "untitled".
 */
export function slugify(text: string): string {
  const slug = text
    .toString()
    .normalize('NFD') // separa i caratteri accentati
    .replace(/[̀-ͯ]/g, '') // rimuove accenti
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // sostituisce caratteri non alfanumerici con '-'
    .replace(/^-+|-+$/g, ''); // rimuove '-' iniziali/finali
  return slug || 'untitled';
}

/**
 * Primo slug libero tra `base`, `base-2`, `base-3`… dati gli slug già presenti
 * nel tenant (basta passare quelli che iniziano con `base`).
 * ponytail: lettura e insert non atomici, due create concorrenti con lo stesso titolo
 * → una prende P2002/409 SLUG_TAKEN; retry sul P2002 se diventa un problema reale.
 */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

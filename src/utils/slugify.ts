/**
 * Genera uno slug leggibile, sicuro per URL e con un suffisso per evitare conflitti.
 * @param text - Testo di input
 * @returns Uno slug tipo "titolo-articolo-a3f9b2d1"
 */
export function slugifySafe(text: string): string {
  const normalizedText = text
    .toString()
    .normalize('NFD')                     // separa i caratteri accentati
    .replace(/[\u0300-\u036f]/g, '')      // rimuove accenti
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')          // sostituisce caratteri non alfanumerici con '-'
    .replace(/^-+|-+$/g, '');             // rimuove '-' iniziali/finali

  // Genera un suffisso crittograficamente sicuro usando timestamp + random
  const timestamp = Date.now().toString(36); // es: 'xnc8eq'
  const randomPart = crypto.getRandomValues(new Uint8Array(4)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '').slice(0, 8); // es: 'a3f9b2d1'
  const suffix = `${timestamp}${randomPart}`.slice(-8); // Prende ultimi 8 caratteri per univocità
  return `${normalizedText}-${suffix}`;
}

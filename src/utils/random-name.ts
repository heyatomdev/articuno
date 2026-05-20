/**
 * Generates random Docker-style names: <adjective>_<famous_person>
 * e.g. "lucido_curie", "brillante_turing"
 */

const ADJECTIVES = [
  'acuto', 'agile', 'allegro', 'ardito', 'astuto',
  'audace', 'brillante', 'calmo', 'capace', 'coraggioso',
  'curioso', 'deciso', 'dinamico', 'elegante', 'energico',
  'eroico', 'fervido', 'fiero', 'focoso', 'forte',
  'gaio', 'geniale', 'giovane', 'grande', 'illuminato',
  'instancabile', 'intrepido', 'inventivo', 'lucido', 'luminoso',
  'maioso', 'nobile', 'originale', 'paziente', 'perspicace',
  'preciso', 'pronto', 'rapido', 'risoluto', 'robusto',
  'sagace', 'saggio', 'sereno', 'sicuro', 'silenzioso',
  'sincero', 'solare', 'tenace', 'visionario', 'vivace',
];

const FAMOUS_PEOPLE = [
  'archimede', 'aristotele', 'avogadro', 'bohr', 'boltzmann',
  'borges', 'calvino', 'cantor', 'copernico', 'curie',
  'darwin', 'davinci', 'dirac', 'einstein', 'euler',
  'faraday', 'fermi', 'feynman', 'fibonacci', 'galileo',
  'gauss', 'hawking', 'heisenberg', 'hopper', 'hume',
  'kant', 'kepler', 'kolmogorov', 'lagrange', 'laplace',
  'leibniz', 'lovelace', 'mandelbrot', 'marconi', 'maxwell',
  'mendelev', 'newton', 'noether', 'pascal', 'pasteur',
  'planck', 'poincare', 'ramanujan', 'riemann', 'rutherford',
  'schrodinger', 'turing', 'volta', 'vonneumann', 'wozniak',
];

/**
 * Returns a random element from an array.
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random Docker-style name like "brillante_turing".
 */
export function generateRandomName(): string {
  const adj = pick(ADJECTIVES);
  const person = pick(FAMOUS_PEOPLE);
  return `${adj.charAt(0).toUpperCase() + adj.slice(1)} ${person.charAt(0).toUpperCase() + person.slice(1)}`;
}


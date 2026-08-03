/**
 * Common Chilean given names and surnames used as the "does a recorded page contain a real
 * person's name" tripwire (spec Business Rule 26, AC5; implementation plan Testing Strategy →
 * parser-risk addendum → `findNameViolations`). Matched whole-word, case- and
 * accent-insensitively by `src/testing/fixture-scan.ts`.
 *
 * These are simply common Spanish-language names, not anyone's real personal data. A committed
 * fixture must never use any of these tokens (or a real-looking name at all) anywhere in its
 * markup; the synthetic names used instead are recorded in `synthetic-allowlist.ts`.
 */
export const PROHIBITED_NAME_TOKENS: readonly string[] = [
  // Common Chilean given names.
  'Juan',
  'Jose',
  'Luis',
  'Carlos',
  'Jorge',
  'Manuel',
  'Pedro',
  'Francisco',
  'Diego',
  'Sebastian',
  'Cristian',
  'Rodrigo',
  'Andres',
  'Felipe',
  'Ricardo',
  'Alejandro',
  'Maria',
  'Ana',
  'Carmen',
  'Patricia',
  'Claudia',
  'Francisca',
  'Andrea',
  'Camila',
  'Valentina',
  'Javiera',
  'Constanza',
  'Daniela',
  'Fernanda',
  'Paula',
  // Common Chilean surnames.
  'Gonzalez',
  'Muñoz',
  'Rojas',
  'Diaz',
  'Perez',
  'Soto',
  'Contreras',
  'Silva',
  'Martinez',
  'Sepulveda',
  'Morales',
  'Rodriguez',
  'Lopez',
  'Fuentes',
  'Hernandez',
  'Torres',
  'Araya',
  'Flores',
  'Espinoza',
  'Valenzuela',
  'Castillo',
  'Reyes',
  'Gutierrez',
  'Vargas',
  'Tapia',
  'Sanchez',
  'Vega',
  'Carrasco',
  'Fernandez',
  'Ramirez',
];

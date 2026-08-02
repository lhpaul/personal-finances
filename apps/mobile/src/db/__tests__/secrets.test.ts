import fs from 'node:fs';
import path from 'node:path';

import { buildCatalogue } from '../seeds/catalogue';

/**
 * Scenario 5 (AC5), per the Testing Strategy's test-file table. Matches the smoke runbook's grep
 * exactly: `password|clave|token|secret|[0-9]{7,8}-[0-9kK]\b`, case-insensitive, and
 * deliberately **not** the bare substring `rut` — `users.national_id_type = 'rut'` is a required
 * type discriminator with no credential value behind it, and a bare-word check would fail on a
 * row this item is required to seed.
 */
const SECRET_PATTERN = /password|clave|token|secret|\b[0-9]{7,8}-[0-9kK]\b/i;

const FIXTURES_DIR = path.resolve(__dirname, '../__fixtures__');

function fixtureFiles(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json') || name.endsWith('.sql'))
    .map((name) => path.join(FIXTURES_DIR, name));
}

describe('secrets scan (AC5)', () => {
  it('every committed fixture under src/db/__fixtures__/ is free of RUT-shaped strings, passwords, tokens and secrets', () => {
    const files = fixtureFiles();
    expect(files.length).toBeGreaterThan(0); // a broken glob must not make this vacuously pass
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const match = SECRET_PATTERN.exec(content);
      expect({ file: path.basename(file), match: match?.[0] }).toEqual({
        file: path.basename(file),
        match: undefined,
      });
    }
  });

  it('the seed catalogue (institutions, categories, merchants, aliases) is free of the same patterns', () => {
    const catalogue = buildCatalogue();
    const serialized = JSON.stringify(catalogue);
    const match = SECRET_PATTERN.exec(serialized);
    expect(match?.[0]).toBeUndefined();
  });

  it('the bare substring "rut" alone is expected and allowed (users.national_id_type)', () => {
    // Sanity check on the pattern itself: it must not fire on the literal discriminator value.
    expect(SECRET_PATTERN.test('rut')).toBe(false);
    expect(SECRET_PATTERN.test('national_id_type')).toBe(false);
  });
});

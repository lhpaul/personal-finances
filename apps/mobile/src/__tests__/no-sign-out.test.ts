import fs from 'node:fs';
import path from 'node:path';

import en from '../i18n/en.json';
import es from '../i18n/es.json';

/**
 * Brief AC4 ("no sign-out affordance exists anywhere in settings") and implementation plan for
 * issue #19, Decision 13. Scoped repository-wide, not just to `settings`, because AGENTS.md
 * non-negotiable 7 ("no account, no session, no auth secret") makes both rules true everywhere in
 * the MVP — a narrower scope would let the affordance reappear one screen over. Mirrors
 * `secure-store-boundary.test.ts`'s shape (a fixed pattern, not template-interpolated; a file
 * walk with a non-vacuous-result guard; the scanner's own edge cases as its own describe block).
 *
 * Edge-case enumeration N1-N12 from the implementation plan's Testing Strategy → Parser-risk
 * addendum.
 */

const CATALOGUE_PATTERN =
  /cerrar sesi[oó]n|salir de (la|mi) cuenta|sign\s?out|log\s?out|iniciar sesi[oó]n|crear cuenta/i;

const SOURCE_IDENTIFIER_PATTERN = /\b(signOut|logOut|logout|signIn|logIn)\b/g;

/** Returns every matched identifier, in order — not merely whether one exists (N11: a file with
 * two matches must report both, so a truncated scan is visible in the failure message). */
function findSignOutIdentifiers(source: string): string[] {
  return Array.from(source.matchAll(SOURCE_IDENTIFIER_PATTERN), (match) => match[1] as string);
}

const ROOTS = [path.resolve(__dirname, '..', '..', 'app'), path.resolve(__dirname, '..')];

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** This file's own planted-violation fixtures (N1-N12 below) are sign-out-shaped strings by
 * design — they would otherwise trip the very scan this suite runs over every other file
 * (mirrors `secure-store-boundary.test.ts`'s `SELF_EXCLUDED_PATHS`). */
const SELF_EXCLUDED_PATHS = [path.resolve(__filename)];

describe('no sign-out affordance exists anywhere (brief AC4; Decision 13)', () => {
  describe('catalogue rule', () => {
    const esEntries = Object.entries(es as Record<string, string>);
    const enEntries = Object.entries(en as Record<string, string>);

    it('found catalogue entries to check', () => {
      expect(esEntries.length).toBeGreaterThan(0);
      expect(enEntries.length).toBeGreaterThan(0);
    });

    it.each(esEntries)('es.json["%s"] has no session-ending copy', (_key, value) => {
      expect(CATALOGUE_PATTERN.test(value)).toBe(false);
    });

    it.each(enEntries)('en.json["%s"] has no session-ending copy', (_key, value) => {
      expect(CATALOGUE_PATTERN.test(value)).toBe(false);
    });
  });

  describe('source rule', () => {
    const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : [])).filter(
      (file) => !SELF_EXCLUDED_PATHS.includes(path.resolve(file)),
    );

    it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
      '%s has no sign-out/sign-in identifier',
      (_label, file) => {
        const source = fs.readFileSync(file, 'utf8');
        expect(findSignOutIdentifiers(source)).toEqual([]);
      },
    );
  });

  describe('scanner edge cases (N1-N12)', () => {
    it('N1: "Cerrar sesión" is flagged', () => {
      expect(CATALOGUE_PATTERN.test('Cerrar sesión')).toBe(true);
    });

    it('N2: "Cerrar sesion" (no accent) is flagged', () => {
      expect(CATALOGUE_PATTERN.test('Cerrar sesion')).toBe(true);
    });

    it('N3: "CERRAR SESIÓN" is flagged (case-insensitive)', () => {
      expect(CATALOGUE_PATTERN.test('CERRAR SESIÓN')).toBe(true);
    });

    it('N4: "Sign out" / "Signout" / "Log out" are flagged', () => {
      expect(CATALOGUE_PATTERN.test('Sign out')).toBe(true);
      expect(CATALOGUE_PATTERN.test('Signout')).toBe(true);
      expect(CATALOGUE_PATTERN.test('Log out')).toBe(true);
    });

    it('N5: "Salir de la cuenta" and "Salir de mi cuenta" are flagged', () => {
      expect(CATALOGUE_PATTERN.test('Salir de la cuenta')).toBe(true);
      expect(CATALOGUE_PATTERN.test('Salir de mi cuenta')).toBe(true);
    });

    it('N6: "Salir de la app" is NOT flagged — leaving the app is not ending a session', () => {
      expect(CATALOGUE_PATTERN.test('Salir de la app')).toBe(false);
    });

    it('N7: "Debes cerrar sesión en el sitio de tu banco después de usarlo" is flagged — an accepted false positive (the sentence is about the bank\'s own web session, not this app\'s); the MVP has no such copy', () => {
      expect(CATALOGUE_PATTERN.test('Debes cerrar sesión en el sitio de tu banco después de usarlo')).toBe(true);
    });

    it('N8: "function signOut()" is flagged', () => {
      expect(findSignOutIdentifiers('function signOut() {}')).toEqual(['signOut']);
    });

    it('N9: "const designedOutcome = …" is NOT flagged — word boundaries only', () => {
      expect(findSignOutIdentifiers('const designedOutcome = 1;')).toEqual([]);
    });

    it('N10: a comment mentioning "sign-out" in prose is NOT flagged — the source rule matches identifiers, not hyphenated prose', () => {
      expect(findSignOutIdentifiers('// there is no sign-out in this product (BR0)')).toEqual([]);
    });

    it('N11: two matches on one line both flag, and the scan reports both, not just the first', () => {
      expect(findSignOutIdentifiers('signOut(); logOut();')).toEqual(['signOut', 'logOut']);
    });

    it('N12: an identifier that merely contains these letters as a substring of a longer word is not confused with a real match (word-boundary precision; the file-walk non-vacuity half of N12 is the "found at least one file to scan" test above)', () => {
      expect(findSignOutIdentifiers('const loginPageUrl = "/login";')).toEqual([]);
    });
  });
});

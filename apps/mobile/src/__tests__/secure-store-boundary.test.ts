import fs from 'node:fs';
import path from 'node:path';

/**
 * Implementation plan Decision 4 / AGENTS.md non-negotiable 1: the secure-store access boundary
 * is enforced by the `secureStoreBoundary` lint rule (`eslint.config.mjs`, applied from
 * `apps/mobile/eslint.config.mjs`) **and** by this test, so the guarantee survives a
 * lint-config regression. Mirrors `src/db/__tests__/db-access-boundary.test.ts`'s shape exactly.
 * Scans `app/**` and `src/**` (excluding `src/lib/secure-store/**`, the one place this import is
 * allowed) for the same import specifier the lint rule forbids.
 *
 * Edge-case enumeration S1-S9 from the implementation plan's Testing Strategy → Parser-risk
 * addendum (S9 added in review — CodeRabbit PR #80: dynamic `import()` was not originally
 * detected).
 */

const ROOTS = [
  path.resolve(__dirname, '..', '..', 'app'),
  path.resolve(__dirname, '..'),
];

const SECURE_STORE_DIR = path.resolve(__dirname, '..', 'lib', 'secure-store');

function isUnderSecureStoreDir(filePath: string): boolean {
  const relative = path.relative(SECURE_STORE_DIR, filePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

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

/** Matches a static `import ... from '<specifier>'` (or a subpath), `require('<specifier>')`, or
 * a dynamic `import('<specifier>')` (S9) — the specifier must end exactly at the package name or
 * a `/` boundary (S4, S5). The pattern is a fixed literal, not built from a variable (found in
 * review — CodeRabbit PR #80's `ast-grep` ReDoS finding against the earlier
 * template-interpolated version): there is exactly one forbidden specifier here, unlike
 * `db-access-boundary.test.ts`'s array of three, so no interpolation is needed at all. */
function findForbiddenImports(source: string): boolean {
  const pattern =
    /(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*)['"]expo-secure-store(?:\/[^'"]*)?['"]/;
  return pattern.test(source);
}

/** Files whose own planted-violation fixtures are import-shaped strings by design — they would
 * otherwise trip the very scan this suite runs over every other file. `secure-store-boundary.
 * test.ts` is this file's own S1-S8 edge cases below; `no-secure-store.test.ts` is item #10's
 * independent, `src/features/sync/`-scoped boundary scanner (merged after this item's
 * implementation started), whose own planted-violation proof contains the same kind of literal
 * test-data string. */
const SELF_EXCLUDED_PATHS = [
  path.resolve(__dirname, 'secure-store-boundary.test.ts'),
  path.resolve(__dirname, '..', 'features', 'sync', '__tests__', 'no-secure-store.test.ts'),
];

describe('no file outside src/lib/secure-store/ imports expo-secure-store (non-negotiable 1)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []))
    .filter((file) => !isUnderSecureStoreDir(file))
    .filter((file) => !SELF_EXCLUDED_PATHS.includes(file));

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s has no expo-secure-store import',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(findForbiddenImports(source)).toBe(false);
    },
  );

  describe('scanner edge cases (S1-S9)', () => {
    it('S1: `import * as SecureStore from \'expo-secure-store\'` is flagged', () => {
      expect(findForbiddenImports("import * as SecureStore from 'expo-secure-store';")).toBe(true);
    });

    it('S2: `import { getItemAsync } from "expo-secure-store"` is flagged (double quotes)', () => {
      expect(findForbiddenImports('import { getItemAsync } from "expo-secure-store";')).toBe(true);
    });

    it("S3: `require('expo-secure-store')` is flagged", () => {
      expect(findForbiddenImports("const x = require('expo-secure-store');")).toBe(true);
    });

    it('S4: `from \'expo-secure-store/build/SecureStore\'` is flagged — subpaths count', () => {
      expect(
        findForbiddenImports("import { WHEN_UNLOCKED } from 'expo-secure-store/build/SecureStore';"),
      ).toBe(true);
    });

    it("S5: `from 'expo-secure-store-mock'` is NOT flagged — the specifier must end at the package name or a '/'", () => {
      expect(findForbiddenImports("import x from 'expo-secure-store-mock';")).toBe(false);
    });

    it('S6: a bare mention inside a comment is NOT flagged — prose, not an import', () => {
      expect(
        findForbiddenImports('// expo-secure-store is the only place a credential lives'),
      ).toBe(false);
    });

    it('S7: the exemption covers exactly one file — the adapter itself', () => {
      const allFiles = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []));
      const exempted = allFiles.filter((file) => isUnderSecureStoreDir(file));
      const adapterFiles = exempted.filter((file) => findForbiddenImports(fs.readFileSync(file, 'utf8')));
      expect(adapterFiles).toEqual([path.join(SECURE_STORE_DIR, 'expo-secure-store.adapter.ts')]);
    });

    it("S9: `await import('expo-secure-store')` (dynamic import) is flagged", () => {
      expect(findForbiddenImports("const SecureStore = await import('expo-secure-store');")).toBe(
        true,
      );
      expect(
        findForbiddenImports("import('expo-secure-store/build/SecureStore').then((m) => m);"),
      ).toBe(true);
    });

    it('S8: two import statements on one line both flag — the scan is global, not first-match', () => {
      const source =
        "import a from 'expo-secure-store'; import b from 'expo-secure-store/build/SecureStore';";
      // A single boolean scan already reports "flagged" for a line with two matches; this
      // asserts the underlying regex actually finds a match in each half independently, so a
      // change to "first match only" semantics would be caught here.
      const halves = source.split(';').filter((half) => half.trim().length > 0);
      for (const half of halves) {
        expect(findForbiddenImports(half)).toBe(true);
      }
    });
  });
});

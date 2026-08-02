import fs from 'node:fs';
import path from 'node:path';

/**
 * Implementation plan Decision 19 / AC26: the SQL access boundary is enforced by the
 * `dbAccessBoundary` lint rule (`eslint.config.mjs`, applied from
 * `apps/mobile/eslint.config.mjs`) **and** by this test, so the guarantee survives a lint-config
 * regression. Scans `app/**` and `src/**` (excluding `src/db/**`, which is the one place these
 * imports are allowed) for the same import specifiers the lint rule forbids.
 */

const FORBIDDEN_SPECIFIERS = ['drizzle-orm', 'expo-sqlite', 'better-sqlite3'];

const ROOTS = [path.resolve(__dirname, '..', '..', '..', 'app'), path.resolve(__dirname, '..', '..', '..', 'src')];

const DB_DIR = path.resolve(__dirname, '..');

function isUnderDbDir(filePath: string): boolean {
  const relative = path.relative(DB_DIR, filePath);
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

/** Matches a static `import ... from '<specifier>'` or `require('<specifier>')`, where
 * `<specifier>` is exactly one of the forbidden packages or one of its subpaths
 * (`drizzle-orm/expo-sqlite`, etc.) — a substring match would also flag an unrelated package that
 * merely contains the string (there is none today, but the boundary is exact by construction). */
function findForbiddenImports(source: string, specifier: string): boolean {
  const pattern = new RegExp(
    `(?:import\\s[^;]*?from\\s*|require\\s*\\(\\s*)['"]${specifier}(?:/[^'"]*)?['"]`,
  );
  return pattern.test(source);
}

describe('no file outside src/db/ imports drizzle-orm, expo-sqlite or better-sqlite3 (AC26)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : [])).filter(
    (file) => !isUnderDbDir(file),
  );

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s has no forbidden SQL-library import',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const hits = FORBIDDEN_SPECIFIERS.filter((specifier) => findForbiddenImports(source, specifier));
      expect(hits).toEqual([]);
    },
  );
});

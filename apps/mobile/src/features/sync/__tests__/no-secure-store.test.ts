import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Implementation plan Decision 16 (issue #10; spec Business Rules 1-2, AC29): the sync engine
 * never reads the secure store and never hashes anything itself — it is handed the connection's
 * `credentials_key` (a name, not a value) and forwards it to the injected `ScraperRunner`. Mirrors
 * `packages/bank-scraper/src/security/no-secure-store.test.ts`'s own guard, scoped to
 * `src/features/sync/` and extended to `expo-crypto` (this feature never needs to hash — that is
 * `src/db/ids.ts`'s `DbPorts.digestSha256` port, injected, never imported directly here).
 */

const FEATURE_ROOT = join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.turbo']);

const FORBIDDEN_MODULES = ['expo-secure-store', 'expo-crypto'];

function importPattern(specifier: string): RegExp {
  return new RegExp(
    `from\\s+['"]${specifier}['"]|(?:require|import)\\(\\s*['"]${specifier}['"]\\s*\\)`,
    'u',
  );
}

function listSourceFiles(dir: string, base: string = dir): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath, base));
    } else if (/\.tsx?$/u.test(entry)) {
      files.push(fullPath.slice(base.length + 1));
    }
  }
  return files;
}

// This scanner's own file is excluded: its planted-violation proof deliberately contains
// synthetic imports as scanner test data, not a real import.
const SELF_FILE = join('__tests__', 'no-secure-store.test.ts');

describe('no-secure-store (src/features/sync)', () => {
  const allSourceFiles = listSourceFiles(FEATURE_ROOT).filter((file) => file !== SELF_FILE);

  it('finds a non-trivial file set (canary against an empty/misconfigured walk)', () => {
    expect(allSourceFiles.length).toBeGreaterThan(3);
  });

  it.each(FORBIDDEN_MODULES)('no file imports %s', (specifier) => {
    const pattern = importPattern(specifier);
    const violations: string[] = [];
    for (const relativePath of allSourceFiles) {
      const content = readFileSync(join(FEATURE_ROOT, relativePath), 'utf-8');
      if (pattern.test(content)) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  it('fires on a planted static import of expo-secure-store (recorded in the PR)', () => {
    const plantedContent = "import * as SecureStore from 'expo-secure-store';";
    expect(importPattern('expo-secure-store').test(plantedContent)).toBe(true);
  });

  it('fires on a planted dynamic import() of expo-secure-store', () => {
    const plantedContent = "const SecureStore = await import('expo-secure-store');";
    expect(importPattern('expo-secure-store').test(plantedContent)).toBe(true);
  });

  it('fires on a planted import of expo-crypto', () => {
    const plantedContent = "import * as Crypto from 'expo-crypto';";
    expect(importPattern('expo-crypto').test(plantedContent)).toBe(true);
  });
});

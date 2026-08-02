import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * This package never reads the secure store — the connect flow (a separate item) reads
 * `expo-secure-store` and hands credentials in as a plain object (implementation plan Decision
 * 5). Banned in this package's own ESLint config (Decision 12); this test asserts it directly by
 * scanning every `.ts`/`.tsx` file for the module specifier.
 */

const PACKAGE_ROOT = join(__dirname, '..', '..');
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.turbo']);
// Also matches a dynamic import() call (CodeRabbit finding #14): the original pattern matched
// only static `import ... from` and `require(...)`, so a dynamic import('expo-secure-store')
// would have passed this scanner undetected.
const SECURE_STORE_IMPORT_PATTERN =
  /from\s+['"]expo-secure-store['"]|(?:require|import)\(\s*['"]expo-secure-store['"]\s*\)/u;

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

// This scanner's own file is excluded: its planted-violation proof below deliberately contains a
// synthetic expo-secure-store import as scanner test data, not a real import.
const SELF_FILE = join('src', 'security', 'no-secure-store.test.ts');

describe('no-secure-store', () => {
  const allSourceFiles = listSourceFiles(PACKAGE_ROOT).filter((file) => file !== SELF_FILE);

  it('finds a non-trivial file set (canary against an empty/misconfigured walk)', () => {
    expect(allSourceFiles.length).toBeGreaterThan(10);
  });

  it('no file imports expo-secure-store', () => {
    const violations: string[] = [];
    for (const relativePath of allSourceFiles) {
      const content = readFileSync(join(PACKAGE_ROOT, relativePath), 'utf-8');
      if (SECURE_STORE_IMPORT_PATTERN.test(content)) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  it('fires on a planted violation (recorded in the PR): a synthetic import of expo-secure-store', () => {
    const plantedContent = "import * as SecureStore from 'expo-secure-store';";
    expect(SECURE_STORE_IMPORT_PATTERN.test(plantedContent)).toBe(true);
  });

  it('fires on a planted dynamic import() of expo-secure-store (CodeRabbit finding #14)', () => {
    const plantedContent = "const SecureStore = await import('expo-secure-store');";
    expect(SECURE_STORE_IMPORT_PATTERN.test(plantedContent)).toBe(true);
  });
});

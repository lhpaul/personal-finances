import fs from 'node:fs';
import path from 'node:path';

/**
 * Testing Strategy scenario 13 (implementation plan Decision 5, Decision 1, Decision 10, issue
 * #11). The global `expo-secure-store` boundary is already enforced repo-wide by
 * `src/__tests__/secure-store-boundary.test.ts` (which already scans every file under this
 * feature and under `src/dev/`) — this file adds the two guarantees that scanner does not cover:
 * that `@finanzas/bank-scraper/src/component` (the deep-imported, headless-barrel-excluded
 * WebView component) has exactly one importer in the whole app, and that
 * `src/dev/scripted-runner.ts` — the `__DEV__`-only fixture surface — imports neither it nor
 * `expo-secure-store`, so the fixture surface structurally cannot become a credential or
 * WebView path.
 */

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app');
const SRC_ROOT = path.resolve(__dirname, '..', '..', '..');

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

/** Matches a static `import ... from '<specifier>'` (or subpath) or `require('<specifier>')` —
 * mirrors `secure-store-boundary.test.ts` / `db-access-boundary.test.ts`'s proven pattern, so a
 * bare-prose mention of the specifier in a doc comment (this file's own module comment above, or
 * `scripted-runner.ts`'s) is not mistaken for a real import. */
function findImport(source: string, specifier: string): boolean {
  // Escaped before interpolation (found in review — CodeRabbit PR #85): both call sites below
  // pass a specifier with no regex metacharacters today, but an unescaped `.` in a future
  // dotted-path specifier would silently become a wildcard, letting this boundary test pass
  // against a near-miss import while the real credential/WebView boundary stayed broken.
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:import\\s[^;]*?from\\s*|require\\s*\\(\\s*)['"]${escaped}(?:/[^'"]*)?['"]`);
  return pattern.test(source);
}

describe('the scraper component has exactly one importer in apps/mobile (Decision 1)', () => {
  const files = [...listSourceFiles(APP_ROOT), ...listSourceFiles(SRC_ROOT)];

  it('found at least one file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('the only importer is use-scraper-runner.tsx', () => {
    const importers = files.filter((file) =>
      findImport(fs.readFileSync(file, 'utf8'), '@finanzas/bank-scraper/src/component'),
    );
    expect(importers).toEqual([path.resolve(__dirname, '..', 'use-scraper-runner.tsx')]);
  });
});

describe('src/dev/scripted-runner.ts (Decision 10)', () => {
  const source = fs.readFileSync(path.resolve(SRC_ROOT, 'dev', 'scripted-runner.ts'), 'utf8');

  it('imports no expo-secure-store', () => {
    expect(findImport(source, 'expo-secure-store')).toBe(false);
  });

  it('imports no @finanzas/bank-scraper/src/component', () => {
    expect(findImport(source, '@finanzas/bank-scraper/src/component')).toBe(false);
  });
});

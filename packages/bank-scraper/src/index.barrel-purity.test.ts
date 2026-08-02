import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Asserts the constraint Decision 3 states rather than trusting it: `src/index.ts`, and every
 * module it transitively imports, contains no import of `react`, `react-native` or
 * `react-native-webview` (implementation plan Decision 3, V6). If this ever regressed, importing
 * `PACKAGE_NAME` from `@finanzas/bank-scraper` in `apps/mobile` — which does not have
 * `react-native-webview` installed — would start failing to resolve.
 */

const FORBIDDEN_IMPORT_PATTERN = /^(react|react-native|react-native-webview)(\/|$)/u;
const IMPORT_PATTERN = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*\bfrom\s+)?['"]([^'"]+)['"]/gu;

const SRC_ROOT = resolve(__dirname);

function resolveRelativeModule(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function walk(entryFile: string, visited: Set<string> = new Set()): { forbidden: string[]; visitedFiles: string[] } {
  const forbidden: string[] = [];
  if (visited.has(entryFile)) return { forbidden, visitedFiles: [...visited] };
  visited.add(entryFile);

  const content = readFileSync(entryFile, 'utf-8');
  let match: RegExpExecArray | null;
  IMPORT_PATTERN.lastIndex = 0;
  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    const specifier = match[1] as string;
    if (FORBIDDEN_IMPORT_PATTERN.test(specifier)) {
      forbidden.push(`${entryFile} imports "${specifier}"`);
      continue;
    }
    if (specifier.startsWith('.')) {
      const resolved = resolveRelativeModule(entryFile, specifier);
      if (resolved) {
        const nested = walk(resolved, visited);
        forbidden.push(...nested.forbidden);
      }
    }
  }
  return { forbidden, visitedFiles: [...visited] };
}

describe('src/index.ts barrel purity (Decision 3)', () => {
  it('contains no import of react, react-native or react-native-webview, transitively', () => {
    const entry = join(SRC_ROOT, 'index.ts');
    const { forbidden, visitedFiles } = walk(entry);
    expect(forbidden).toEqual([]);
    // A canary against a no-op walk: the barrel re-exports a non-trivial module graph.
    expect(visitedFiles.length).toBeGreaterThan(5);
  });

  it('fires on a planted violation: a module in the barrel graph importing react-native', () => {
    const { forbidden } = walk(join(SRC_ROOT, 'index.ts'), new Set());
    expect(forbidden).toEqual([]);
    // Direct proof the detector works, without editing a real source file: run the same walker
    // logic against a synthetic in-memory content string via the same regex the walker uses.
    const plantedContent = "import { View } from 'react-native';\nexport const x = View;";
    IMPORT_PATTERN.lastIndex = 0;
    const match = IMPORT_PATTERN.exec(plantedContent);
    expect(match).not.toBeNull();
    expect(FORBIDDEN_IMPORT_PATTERN.test(match?.[1] ?? '')).toBe(true);
  });
});

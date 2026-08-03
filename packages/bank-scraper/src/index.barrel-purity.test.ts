import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  // Collect every specifier before any recursion, using a fresh regex per call rather than the
  // shared module-level IMPORT_PATTERN (CodeRabbit finding #11): IMPORT_PATTERN's `lastIndex` is
  // shared mutable state, and a nested walk() call inside this same while-loop would reset it and
  // run it against a different file's content. When the nested call returns, the outer loop's own
  // `exec` would resume from the nested call's leftover lastIndex, not its own — a nested walk
  // that reached the end of its file would leave lastIndex at 0, restarting the outer loop from
  // the beginning and double-reporting a forbidden specifier found before a relative import.
  const specifiers = [...content.matchAll(new RegExp(IMPORT_PATTERN.source, 'gu'))].map((match) => match[1] as string);
  for (const specifier of specifiers) {
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

  it('fires on a planted violation: a module in the walked graph importing react-native (CodeRabbit finding #12)', () => {
    // The previous version of this test never actually called walk() against a real violation —
    // it ran the barrel's own (clean) graph, then checked the regex directly against an in-memory
    // string with no dependency on walk() at all. A regression inside walk() itself (including
    // the shared-regex lastIndex bug fixed above, or a dropped forbidden.push) would have passed
    // silently. This version writes a real two-file module graph to a temp directory and runs the
    // actual walk() function against it.
    const dir = mkdtempSync(join(tmpdir(), 'barrel-purity-'));
    try {
      writeFileSync(join(dir, 'leaf.ts'), "import { View } from 'react-native';\nexport const x = View;");
      writeFileSync(join(dir, 'entry.ts'), "export { x } from './leaf';");
      const { forbidden } = walk(join(dir, 'entry.ts'));
      expect(forbidden).toHaveLength(1);
      expect(forbidden[0]).toContain('react-native');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

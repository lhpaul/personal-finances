import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CL_BANKS } from '../configs/cl';

/**
 * The residual verification mechanism for AC27 and AC28 — a committed test, not a one-off grep
 * run once at review time (implementation plan "Bank containment and residue"). Everything Banco
 * de Chile-specific lives in its own directory (spec Business Rule 24); no Falabella or
 * Pelotillehue material exists anywhere in this package (spec Decision 12).
 */

const PACKAGE_ROOT = join(__dirname, '..', '..');
const BANCO_DE_CHILE_DIR = join('src', 'configs', 'cl', 'banco-de-chile') + sep;
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.turbo']);
const BANCO_DE_CHILE_PATTERN = /bancochile|banco[-_ ]?de[-_ ]?chile|portales\.bancochile/iu;
const DROPPED_BANKS_PATTERN = /falabella|pelotillehue/iu;
const REGISTRY_FILES = new Set([join('src', 'configs', 'index.ts'), join('src', 'configs', 'cl', 'index.ts')]);

/**
 * Named, documented exceptions to the Banco de Chile containment check — each is a file that
 * cannot avoid referencing the concrete bank without losing real functionality or test value,
 * as opposed to a prose mention that a doc comment can simply avoid. Every file in this repo
 * that merely *mentions* Banco de Chile in a comment has had that comment reworded instead of
 * being added here (implementation plan Decision 1: country-level parsing and bank-agnostic
 * protocol files describe conventions, not the bank, in their own prose).
 *
 * - `jest.config.js`: the `dom` project's `testEnvironmentOptions.url` must equal the single
 *   registered bank's real sign-in origin so `window.location.origin` inside an executed script
 *   passes the in-page origin gate (see the comment at that call site) — a plain `.js` config
 *   file cannot import a compiled constant from a TypeScript source without a build step.
 * - `src/configs/registry.test.ts`: exists specifically to assert the registry's content (AC18,
 *   AC28), which requires referencing the one concretely registered bank id by name throughout.
 * - `src/testing/source-rut-scan.test.ts`: cross-checks that the concretely registered bank's
 *   config wires its RUT field to `@finanzas/shared-utils` rather than a second copy (AC29),
 *   which requires importing that bank's own config.
 * - `src/security/credential-leak.dom.test.ts`: the named end-to-end test for AC2/Business Rule
 *   4 drives a real read through the concretely registered bank's own config and fixtures —
 *   a synthetic bank-agnostic config would not exercise the real login routine this test exists
 *   to prove never leaks a credential.
 * - `src/scripts/all-generated-scripts.ts`: imports every registered bank's reading routines so
 *   `no-float-parsing.test.ts` / `no-network-egress.test.ts` scan every script this package can
 *   actually inject (Decision 10's stated scope), not a selector or parsing rule of its own.
 * - `src/testing/bank-containment.test.ts` (this file): its own planted-violation proof
 *   deliberately contains a Banco de Chile-shaped string as *scanner test data*.
 */
const ALLOWED_EXCEPTION_FILES = new Set([
  'jest.config.js',
  join('src', 'configs', 'registry.test.ts'),
  join('src', 'testing', 'source-rut-scan.test.ts'),
  join('src', 'scripts', 'all-generated-scripts.ts'),
  join('src', 'security', 'credential-leak.dom.test.ts'),
  join('src', 'testing', 'bank-containment.test.ts'),
]);
const SELF_FILE = join('src', 'testing', 'bank-containment.test.ts');

function listAllFiles(dir: string, base: string = dir): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listAllFiles(fullPath, base));
    } else {
      files.push(relative(base, fullPath));
    }
  }
  return files;
}

describe('bank-containment', () => {
  const allFiles = listAllFiles(PACKAGE_ROOT);

  it('finds a non-trivial file set (canary against an empty/misconfigured walk)', () => {
    expect(allFiles.length).toBeGreaterThan(20);
  });

  it('every Banco de Chile reference lives under its own directory, or is a named exception (AC27)', () => {
    const violations: string[] = [];
    for (const relativePath of allFiles) {
      if (ALLOWED_EXCEPTION_FILES.has(relativePath)) continue;
      const isUnderBancoDeChile = relativePath.startsWith(BANCO_DE_CHILE_DIR);
      const isRegistryFile = REGISTRY_FILES.has(relativePath);
      if (isUnderBancoDeChile) continue;

      const fullPath = join(PACKAGE_ROOT, relativePath);
      const content = readFileSync(fullPath, 'utf-8');
      if (!BANCO_DE_CHILE_PATTERN.test(content)) continue;

      if (!isRegistryFile) {
        violations.push(relativePath);
        continue;
      }
      // A registry file may only reference Banco de Chile on its import line and its array
      // entry line — never a selector, a page path, or any other bank-specific detail.
      const matchingLines = content.split('\n').filter((line) => BANCO_DE_CHILE_PATTERN.test(line));
      const nonRegistrationLines = matchingLines.filter(
        (line) => !line.includes('import') && !line.includes('BANCO_DE_CHILE_CONFIG'),
      );
      if (nonRegistrationLines.length > 0) {
        violations.push(`${relativePath} (non-registration line: ${nonRegistrationLines[0]})`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('no file contains Falabella or Pelotillehue material (AC28)', () => {
    const violations: string[] = [];
    for (const relativePath of allFiles) {
      if (relativePath === SELF_FILE) continue;
      const fullPath = join(PACKAGE_ROOT, relativePath);
      const content = readFileSync(fullPath, 'utf-8');
      if (DROPPED_BANKS_PATTERN.test(content)) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  it('the registry lists exactly one bank for Chile: banco-de-chile', () => {
    expect(CL_BANKS).toHaveLength(1);
    expect(CL_BANKS[0]?.id).toBe('banco-de-chile');
  });

  it('the named exceptions are exactly the six documented files, not a widening set', () => {
    expect(ALLOWED_EXCEPTION_FILES.size).toBe(6);
  });

  describe('planted-violation proof (recorded in the PR)', () => {
    it('the containment check would flag a Banco de Chile selector planted outside its directory', () => {
      // Proves the detector logic works without mutating a real source file: the same regex the
      // walker above uses, run against a synthetic "outside the directory" content string.
      const plantedContent = "const RUT_SELECTOR = \"document.getElementById('login.portales.bancochile.cl')\";";
      expect(BANCO_DE_CHILE_PATTERN.test(plantedContent)).toBe(true);
    });
  });
});

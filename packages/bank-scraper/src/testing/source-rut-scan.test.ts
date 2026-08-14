import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isValidRut, normalizeRut } from '@finanzas/shared-utils';
import { CL_BANKS } from '../configs/cl';

/**
 * AC29: Chilean RUT handling in this package is done with `@finanzas/shared-utils` rather than a
 * second copy, and no call site of theirs logs, caches or retains a RUT. This is also the
 * check Documented Deviation D4 asks for: the source's `utils/format/format.utils.ts` is not
 * ported, specifically because its docblock carried a check-digit-valid RUT as an example value
 * — this scanner catches that exact class of mistake if it were ever reintroduced.
 */

const PACKAGE_ROOT = join(__dirname, '..', '..');
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.turbo']);
const RUT_TOKEN_PATTERN = /\b\d{1,2}(?:\.\d{3}){2}-[0-9kK]\b|\b\d{7,8}-[0-9kK]\b/gu;
// The exact weight cycle @finanzas/shared-utils's modulo-11 check-digit algorithm uses. If this
// literal array ever appears elsewhere in this package, that is a second, duplicated
// implementation of RUT check-digit arithmetic rather than a shared-utils call site.
const DUPLICATED_CHECK_DIGIT_ALGORITHM_PATTERN = /\[\s*2,\s*3,\s*4,\s*5,\s*6,\s*7\s*\]/u;

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

describe('source-rut-scan', () => {
  const allSourceFiles = listSourceFiles(PACKAGE_ROOT);
  // Test files legitimately need a rut-shaped value to exercise the login form/credential path;
  // production source should never contain a literal RUT at all.
  const productionFiles = allSourceFiles.filter((file) => !file.includes('.test.'));

  it('finds a non-trivial production file set (canary against an empty/misconfigured walk)', () => {
    expect(productionFiles.length).toBeGreaterThan(10);
  });

  it('no production source file contains a check-digit-valid RUT literal', () => {
    const violations: string[] = [];
    for (const relativePath of productionFiles) {
      const content = readFileSync(join(PACKAGE_ROOT, relativePath), 'utf-8');
      RUT_TOKEN_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = RUT_TOKEN_PATTERN.exec(content)) !== null) {
        if (isValidRut(normalizeRut(match[0]))) {
          violations.push(relativePath);
          break;
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no file duplicates the shared-utils check-digit weight-cycle algorithm', () => {
    const violations: string[] = [];
    for (const relativePath of allSourceFiles) {
      const content = readFileSync(join(PACKAGE_ROOT, relativePath), 'utf-8');
      if (DUPLICATED_CHECK_DIGIT_ALGORITHM_PATTERN.test(content)) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  it('every registered Chilean bank config uses @finanzas/shared-utils for RUT formatting and validation', () => {
    for (const config of CL_BANKS) {
      const rutField = config.fields.find((field) => field.id === 'rut');
      expect(rutField?.formatter).toBeDefined();
      expect(rutField?.validation?.fn).toBeDefined();
      expect(rutField?.formatter?.('123456785')).toBe('12.345.678-5');
      expect(rutField?.validation?.fn?.('12.345.678-5')).toBe(true);
      expect(rutField?.validation?.fn?.('12.345.678-9')).toBe(false);
    }
  });

  describe('planted-violation proof (recorded in the PR)', () => {
    it('catches a planted check-digit-valid RUT the way the production-file scan would', () => {
      // Proves the detector logic works without mutating a real source file: the same pattern
      // and validity check the walker above uses, run against synthetic "planted" content.
      const plantedContent = "/** e.g. 12.345.678-5 */";
      RUT_TOKEN_PATTERN.lastIndex = 0;
      const match = RUT_TOKEN_PATTERN.exec(plantedContent);
      expect(match).not.toBeNull();
      expect(isValidRut(normalizeRut(match?.[0] ?? ''))).toBe(true);
    });
  });
});

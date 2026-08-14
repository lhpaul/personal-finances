import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CL_BANKS } from '../configs/cl';

/**
 * Per-bank containment: each bank's identifiers live under its own directory. Registry files
 * may only import and list configs. `all-generated-scripts.ts` may import every bank's routines.
 */

const PACKAGE_ROOT = join(__dirname, '..', '..');
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.turbo']);
const REGISTRY_FILES = new Set([join('src', 'configs', 'index.ts'), join('src', 'configs', 'cl', 'index.ts')]);

const BANKS: readonly { id: string; dir: string; pattern: RegExp; configSymbol: string }[] = [
  {
    id: 'banco-de-chile',
    dir: join('src', 'configs', 'cl', 'banco-de-chile') + sep,
    pattern: /bancochile|banco[-_ ]?de[-_ ]?chile|portales\.bancochile/iu,
    configSymbol: 'BANCO_DE_CHILE_CONFIG',
  },
  {
    id: 'falabella',
    dir: join('src', 'configs', 'cl', 'banco-falabella') + sep,
    pattern: /falabella|bancofalabella/iu,
    configSymbol: 'BANCO_FALABELLA_CONFIG',
  },
  {
    id: 'banco-pelotillehue',
    dir: join('src', 'configs', 'cl', 'banco-pelotillehue') + sep,
    pattern: /pelotillehue/iu,
    configSymbol: 'BANCO_PELOTILLEHUE_CONFIG',
  },
];

const ALLOWED_EXCEPTION_FILES = new Set([
  'jest.config.js',
  join('src', 'configs', 'registry.test.ts'),
  join('src', 'testing', 'source-rut-scan.test.ts'),
  join('src', 'scripts', 'all-generated-scripts.ts'),
  join('src', 'security', 'credential-leak.dom.test.ts'),
  join('src', 'testing', 'bank-containment.test.ts'),
]);

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

  it('the registry lists each bank once, with unique ids', () => {
    expect(CL_BANKS.map((bank) => bank.id).sort()).toEqual(BANKS.map((bank) => bank.id).sort());
    expect(new Set(CL_BANKS.map((bank) => bank.id)).size).toBe(CL_BANKS.length);
  });

  it('every bank-specific reference lives under that bank\'s directory, a registry file, or a named exception', () => {
    const violations: string[] = [];
    for (const bank of BANKS) {
      for (const relativePath of allFiles) {
        if (ALLOWED_EXCEPTION_FILES.has(relativePath)) continue;
        if (relativePath.startsWith(bank.dir)) continue;

        const content = readFileSync(join(PACKAGE_ROOT, relativePath), 'utf-8');
        if (!bank.pattern.test(content)) continue;

        if (!REGISTRY_FILES.has(relativePath)) {
          violations.push(`${relativePath} mentions ${bank.id}`);
          continue;
        }
        const matchingLines = content.split('\n').filter((line) => bank.pattern.test(line));
        const nonRegistrationLines = matchingLines.filter(
          (line) => !line.includes('import') && !line.includes(bank.configSymbol),
        );
        if (nonRegistrationLines.length > 0) {
          violations.push(`${relativePath} (non-registration line for ${bank.id}: ${nonRegistrationLines[0]})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('the named exceptions are exactly the six documented files, not a widening set', () => {
    expect(ALLOWED_EXCEPTION_FILES.size).toBe(6);
  });

  describe('planted-violation proof', () => {
    it('the containment check would flag a Banco de Chile selector planted outside its directory', () => {
      const plantedContent = "const RUT_SELECTOR = \"document.getElementById('login.portales.bancochile.cl')\";";
      expect(BANKS[0]?.pattern.test(plantedContent)).toBe(true);
    });
  });
});

import fs from 'node:fs';
import path from 'node:path';

import { findStyleLiterals, type StyleLiteral } from '../test-utils/style-literal-scan';

const ROOTS = [
  path.resolve(__dirname, '..', '..', 'app'),
  path.resolve(__dirname, '..'),
];

/** `theme.ts` is where the literals belong (Decision 2); test files are exempt because
 * asserting a literal (e.g. `hitSlop.top === 11`) is not a style literal, and the scanners'
 * own fixtures are full of intentional violations. */
function isExcluded(filePath: string): boolean {
  if (filePath.endsWith(`${path.sep}theme.ts`)) return true;
  if (/\.test\.(ts|tsx)$/.test(filePath)) return true;
  return false;
}

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !isExcluded(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('no hardcoded style literals outside theme.ts (AC1)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []));

  it('found at least one file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s has no hex, rgb(), or numeric style-property literal',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const violations: StyleLiteral[] = findStyleLiterals(source);
      expect(violations).toEqual([]);
    },
  );
});

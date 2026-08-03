import fs from 'node:fs';
import path from 'node:path';

import { findUnguardedPesoTotals } from '../checks/peso-total-scan';

/**
 * Implementation plan Decision 15, Residual verification strategy (issue #10, spec Business
 * Rule 17, Deferral Note 3, AC22). Runs the scanner over the real `apps/mobile/src/` and
 * `apps/mobile/app/` trees and asserts zero findings — no peso-total aggregate anywhere in the
 * codebase sums `includedAmount` without also naming `isPesoDenominated` in the same file.
 *
 * This proves the guard, not merely its presence — see the PR description for the planted-defect
 * proof (add an unguarded `sum(${includedAmount})` to a throwaway repository function, confirm
 * this test fails and names the file and line, then revert).
 */

const ROOTS = [path.resolve(__dirname, '..', '..', '..', 'src'), path.resolve(__dirname, '..', '..', '..', 'app')];

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

describe('no peso-total aggregate sums includedAmount without isPesoDenominated (AC22)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []));

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('the scanner finds zero unguarded peso totals across the whole tree', () => {
    const allFindings = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return findUnguardedPesoTotals(source, file);
    });
    expect(allFindings).toEqual([]);
  });
});

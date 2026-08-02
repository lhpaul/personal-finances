import fs from 'node:fs';
import path from 'node:path';

import { findInclusionRuleRestatements } from '../checks/inclusion-rule-scan';

/**
 * Implementation plan Decision 9 / AC20: `src/db/fragments.ts` is the only place the inclusion
 * rule is stated. This test runs the scanner over the real `apps/mobile/src/` and
 * `apps/mobile/app/` trees — the whole surface a screen or a repository is allowed to live in —
 * and asserts zero findings.
 *
 * This proves there is no *second* statement of the rule. It does not prove the *one* statement
 * computes the right number — `transactions.test.ts` carries that result-level assertion
 * independently (Testing Strategy scenario 20).
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

describe('the inclusion rule is stated in exactly one place (AC20)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []));

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('the scanner finds zero restatements across the whole tree', () => {
    const allFindings = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return findInclusionRuleRestatements(source, file);
    });
    expect(allFindings).toEqual([]);
  });
});

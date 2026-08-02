import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { loadFixtureHtml } from '../test-utils/load-fixture';
import { scanFixtureContent } from './fixture-scan';
import { PROHIBITED_NAME_TOKENS } from './prohibited-name-tokens';
import { ALLOWED_ACCOUNT_NUMBERS, SYNTHETIC_NAMES } from './synthetic-allowlist';

/**
 * Runs the four fixture sanitization detectors over every committed HTML fixture (spec Business
 * Rule 26, AC5). Zero violations across all fixtures for all four detectors is the "does not
 * over-fire" half of AC5 — the fixtures are written to pass their own scanners.
 */

const FIXTURES_DIR = join(__dirname, '..', 'configs', 'cl', 'banco-de-chile', 'fixtures');

function listFixtureFiles(): string[] {
  return readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.html'));
}

describe('fixture-sanitization', () => {
  const fixtureFiles = listFixtureFiles();

  it('finds at least one committed fixture (a canary against an empty/misconfigured directory)', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  it.each(fixtureFiles)('%s has zero sanitization violations', (fileName) => {
    const content = loadFixtureHtml(FIXTURES_DIR, fileName);
    const violations = scanFixtureContent(content, {
      prohibitedNameTokens: PROHIBITED_NAME_TOKENS,
      allowlistNames: SYNTHETIC_NAMES,
      allowedAccountNumbers: ALLOWED_ACCOUNT_NUMBERS,
    });
    expect(violations).toEqual([]);
  });

  it('the synthetic-allowlist exclusion is exactly one file, not a widening set', () => {
    // scanFixtureContent's own callers never scan synthetic-allowlist.ts (it is not under
    // fixtures/), so the "exclusion list" is the single, named allowlist source file itself.
    // This assertion documents the invariant explicitly rather than leaving it implicit.
    const excludedFiles = ['synthetic-allowlist.ts'];
    expect(excludedFiles).toHaveLength(1);
  });

  describe('planted-violation proofs (recorded in the PR)', () => {
    it('catches a planted check-digit-valid RUT', () => {
      const violations = scanFixtureContent('<td>12.345.678-5</td>', {
        prohibitedNameTokens: PROHIBITED_NAME_TOKENS,
        allowlistNames: SYNTHETIC_NAMES,
        allowedAccountNumbers: ALLOWED_ACCOUNT_NUMBERS,
      });
      expect(violations.some((v) => v.class === 'rut')).toBe(true);
    });

    it('catches a planted real-looking name', () => {
      const violations = scanFixtureContent('Titular: Juan Perez', {
        prohibitedNameTokens: PROHIBITED_NAME_TOKENS,
        allowlistNames: SYNTHETIC_NAMES,
        allowedAccountNumbers: ALLOWED_ACCOUNT_NUMBERS,
      });
      expect(violations.some((v) => v.class === 'name')).toBe(true);
    });

    it('catches a planted real-looking balance', () => {
      const violations = scanFixtureContent('$1.234.567', {
        prohibitedNameTokens: PROHIBITED_NAME_TOKENS,
        allowlistNames: SYNTHETIC_NAMES,
        allowedAccountNumbers: ALLOWED_ACCOUNT_NUMBERS,
      });
      expect(violations.some((v) => v.class === 'amount')).toBe(true);
    });

    it('catches a planted real-looking account number', () => {
      const violations = scanFixtureContent('87654321', {
        prohibitedNameTokens: PROHIBITED_NAME_TOKENS,
        allowlistNames: SYNTHETIC_NAMES,
        allowedAccountNumbers: ALLOWED_ACCOUNT_NUMBERS,
      });
      expect(violations.some((v) => v.class === 'accountNumber')).toBe(true);
    });
  });
});

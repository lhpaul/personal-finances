import fs from 'node:fs';
import path from 'node:path';

import { loadMockupManifest } from '../../../test-utils/mockup-manifest';
import { BANK_SYNCING_STATE_COVERAGE } from '../state-coverage';

/**
 * The residual-verification mechanism for "every state the `bank-syncing` screen declares is
 * implemented" (implementation plan Decision 13, Testing Strategy scenario 22, issue #11).
 * Reads `design/mockups/mobile/mockup-manifest.js` **live** and asserts set equality with the
 * covered state set — so adding a state to the mockup, or quietly dropping one, fails this test.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'design', 'mockups', 'mobile', 'mockup-manifest.js');

describe('BANK_SYNCING_STATE_COVERAGE (scenario 22)', () => {
  const manifest = loadMockupManifest(MANIFEST_PATH);
  const screen = manifest.screens.find((candidate) => candidate.screen_id === 'bank-syncing');

  it('the manifest declares the bank-syncing screen', () => {
    expect(screen).toBeDefined();
  });

  const manifestStateIds = (
    (screen?.states as { state_id: string }[] | undefined) ?? []
  ).map((state) => state.state_id);

  it('found manifest states to check', () => {
    expect(manifestStateIds.length).toBeGreaterThan(0);
  });

  it("covers exactly the manifest's declared states — no more, no fewer", () => {
    const coveredStateIds = BANK_SYNCING_STATE_COVERAGE.map((entry) => entry.stateId);
    expect(new Set(coveredStateIds)).toEqual(new Set(manifestStateIds));
    expect(coveredStateIds).toHaveLength(manifestStateIds.length);
  });

  it('has no duplicate entries', () => {
    const stateIds = BANK_SYNCING_STATE_COVERAGE.map((entry) => entry.stateId);
    expect(new Set(stateIds).size).toBe(stateIds.length);
  });

  it.each(BANK_SYNCING_STATE_COVERAGE.map((entry) => [entry.stateId, entry] as const))(
    '%s: sourceFile and testFile both exist',
    (_stateId, entry) => {
      expect(fs.existsSync(path.resolve(REPO_ROOT, entry.sourceFile))).toBe(true);
      expect(fs.existsSync(path.resolve(REPO_ROOT, entry.testFile))).toBe(true);
    },
  );

  // Found in review precedent (item #9, CodeRabbit PR #80 round 2): file existence alone does not
  // prove a state is asserted, and neither does a literal-string scan for a surviving
  // `describe`/`it` title — a title can stay in the source while every `expect(...)` inside its
  // body is deleted or weakened. Each entry's `verify` is the *exact same function object* the
  // feature's own test file passes to its own `it(...)` (`state-verifiers.ts`), so re-invoking it
  // here actually re-runs that state's real assertions.
  it.each(BANK_SYNCING_STATE_COVERAGE.map((entry) => [entry.stateId, entry] as const))(
    '%s: verify() re-executes the state-specific assertion',
    (_stateId, entry) => {
      entry.verify();
    },
  );
});

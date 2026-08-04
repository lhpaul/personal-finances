import fs from 'node:fs';
import path from 'node:path';

import { BANKS_STATE_COVERAGE } from '../state-coverage';
import { loadMockupManifest } from '../../../test-utils/mockup-manifest';

/**
 * The residual-verification mechanism for "every manifest state of both screens is implemented"
 * (implementation plan for issue #20, non-negotiable 6, Testing Strategy Scenario 20). Reads
 * `design/mockups/mobile/mockup-manifest.js` live and asserts set equality with the covered
 * `screenId:stateId` pairs — mirrors `connect-flow-state-coverage.test.ts` (issue #9).
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'design', 'mockups', 'mobile', 'mockup-manifest.js');

const SCREEN_IDS = ['settings-banks', 'bank-review'] as const;

describe('BANKS_STATE_COVERAGE (Scenario 20)', () => {
  const manifest = loadMockupManifest(MANIFEST_PATH);

  const manifestPairs = SCREEN_IDS.flatMap((screenId) => {
    const screen = manifest.screens.find((candidate) => candidate.screen_id === screenId);
    if (!screen) throw new Error(`Manifest has no screen_id "${screenId}"`);
    const states = screen.states as { state_id: string }[] | undefined;
    if (!states || states.length === 0) {
      throw new Error(`Manifest screen "${screenId}" declares no states`);
    }
    return states.map((state) => `${screenId}:${state.state_id}`);
  });

  it('found manifest state pairs to check', () => {
    expect(manifestPairs.length).toBeGreaterThan(0);
  });

  it("covers exactly the manifest's declared states for these two screens — no more, no fewer", () => {
    const coveredPairs = BANKS_STATE_COVERAGE.map((entry) => `${entry.screenId}:${entry.stateId}`);
    expect(new Set(coveredPairs)).toEqual(new Set(manifestPairs));
    expect(coveredPairs).toHaveLength(manifestPairs.length);
  });

  it('has no duplicate entries', () => {
    const pairs = BANKS_STATE_COVERAGE.map((entry) => `${entry.screenId}:${entry.stateId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it.each(BANKS_STATE_COVERAGE.map((entry) => [`${entry.screenId}:${entry.stateId}`, entry] as const))(
    '%s: sourceFile and testFile both exist',
    (_label, entry) => {
      expect(fs.existsSync(path.resolve(REPO_ROOT, entry.sourceFile))).toBe(true);
      expect(fs.existsSync(path.resolve(REPO_ROOT, entry.testFile))).toBe(true);
    },
  );

  it.each(BANKS_STATE_COVERAGE.map((entry) => [`${entry.screenId}:${entry.stateId}`, entry] as const))(
    '%s: verify() re-executes the state-specific assertion',
    (_label, entry) => {
      expect(() => entry.verify()).not.toThrow();
    },
  );
});

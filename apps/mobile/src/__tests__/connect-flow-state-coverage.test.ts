import fs from 'node:fs';
import path from 'node:path';

import { CONNECT_FLOW_STATE_COVERAGE } from '../features/connect-bank/state-coverage';
import { loadMockupManifest } from '../test-utils/mockup-manifest';

/**
 * The residual-verification mechanism for AC28 (implementation plan Testing Strategy, "State-
 * and catalogue-coverage residuals"). Confirms `CONNECT_FLOW_STATE_COVERAGE` enumerates exactly
 * the manifest's declared states for this item's four screens — no more, no fewer — and that
 * every named file exists.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MANIFEST_PATH = path.resolve(REPO_ROOT, 'design', 'mockups', 'mobile', 'mockup-manifest.js');

const SCREEN_IDS = ['connect-bank-intro', 'bank-picker', 'bank-credentials', 'bank-connected'];

describe('CONNECT_FLOW_STATE_COVERAGE (AC28)', () => {
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

  it('covers exactly the manifest\'s declared states for these four screens — no more, no fewer', () => {
    const coveredPairs = CONNECT_FLOW_STATE_COVERAGE.map((entry) => `${entry.screenId}:${entry.stateId}`);
    expect(new Set(coveredPairs)).toEqual(new Set(manifestPairs));
    expect(coveredPairs).toHaveLength(manifestPairs.length);
  });

  it('has no duplicate entries', () => {
    const pairs = CONNECT_FLOW_STATE_COVERAGE.map((entry) => `${entry.screenId}:${entry.stateId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it.each(
    CONNECT_FLOW_STATE_COVERAGE.map((entry) => [`${entry.screenId}:${entry.stateId}`, entry] as const),
  )('%s: sourceFile and testFile both exist', (_label, entry) => {
    const sourcePath = path.resolve(REPO_ROOT, entry.sourceFile);
    const testPath = path.resolve(REPO_ROOT, entry.testFile);
    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(testPath)).toBe(true);
  });
});

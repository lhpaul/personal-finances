import path from 'node:path';

import { loadMockupManifest, type MockupScreen } from '../../../test-utils/mockup-manifest';
import { INTRO_VIEW_STATES, SCHEDULE_VIEW_STATES, SETTINGS_VIEW_STATES } from '../view-state';

const MANIFEST_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'design',
  'mockups',
  'mobile',
  'mockup-manifest.js',
);

type ScreenWithStates = MockupScreen & { states?: { state_id: string }[] };

function manifestStateIds(screens: MockupScreen[], screenId: string): string[] {
  const screen = screens.find((candidate) => candidate.screen_id === screenId) as
    | ScreenWithStates
    | undefined;
  if (!screen?.states) {
    throw new Error(`mockup-manifest.js has no declared states for ${screenId}`);
  }
  return screen.states.map((state) => state.state_id);
}

/**
 * Residual verification (implementation plan for issue #18, Testing Strategy → Residual
 * verification strategy, item 1): asserts each screen's `VIEW_STATES` tuple deep-equals the
 * manifest's declared state ids, in order — non-negotiable 6, mirroring
 * `value-steps-manifest-parity.test.ts`'s precedent for a multi-step screen.
 */
describe('every declared state of the three reminders screens is implemented (non-negotiable 6)', () => {
  const manifest = loadMockupManifest(MANIFEST_PATH);

  it('notifications-intro matches the manifest state ids exactly, in order', () => {
    expect([...INTRO_VIEW_STATES]).toEqual(manifestStateIds(manifest.screens, 'notifications-intro'));
  });

  it('notifications-schedule matches the manifest state ids exactly, in order', () => {
    expect([...SCHEDULE_VIEW_STATES]).toEqual(
      manifestStateIds(manifest.screens, 'notifications-schedule'),
    );
  });

  it('settings-notifications matches the manifest state ids exactly, in order', () => {
    expect([...SETTINGS_VIEW_STATES]).toEqual(
      manifestStateIds(manifest.screens, 'settings-notifications'),
    );
  });
});

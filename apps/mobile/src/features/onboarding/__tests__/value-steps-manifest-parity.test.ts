import path from 'node:path';

import { loadMockupManifest } from '../../../test-utils/mockup-manifest';
import { VALUE_STEPS } from '../value-steps';

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

/**
 * Residual verification (implementation plan Testing Strategy → Residual verification strategy,
 * item 1): asserts `VALUE_STEPS` implements every manifest-declared `onboarding-value` state, in
 * order — non-negotiable 6. A state added to the manifest later fails this test instead of
 * silently going unimplemented.
 */
describe('VALUE_STEPS implements every manifest-declared onboarding-value state (non-negotiable 6)', () => {
  it('matches the manifest state ids exactly, in order', () => {
    const manifest = loadMockupManifest(MANIFEST_PATH);
    const onboardingValue = manifest.screens.find((screen) => screen.screen_id === 'onboarding-value') as
      | { states?: { state_id: string }[] }
      | undefined;

    if (!onboardingValue?.states) {
      throw new Error('mockup-manifest.js has no declared states for onboarding-value');
    }

    const manifestStateIds = onboardingValue.states.map((state) => state.state_id);
    expect(VALUE_STEPS.map((step) => step.stateId)).toEqual(manifestStateIds);
  });
});

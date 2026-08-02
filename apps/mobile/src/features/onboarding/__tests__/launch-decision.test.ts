import { resolveLaunchHref } from '../launch-decision';

/** Testing Strategy scenarios 1 and 2. */
describe('resolveLaunchHref', () => {
  it('a first launch (onboardingCompleted: false) routes to onboarding-intro (AC1)', () => {
    expect(resolveLaunchHref(false)).toBe('/(onboarding)/intro');
  });

  it('a returning launch (onboardingCompleted: true) routes to home (AC1)', () => {
    expect(resolveLaunchHref(true)).toBe('/(tabs)/home');
  });
});

const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// eslint-disable-next-line import/first -- must follow the jest.mock hoist above.
import { fidelityTestId, useFidelityPreview } from '../fidelity-preview';

// `__DEV__` is declared `const` by React Native's ambient types, so it can't be reassigned
// through the bare identifier. It is a real, writable `globalThis` property at runtime (Metro
// defines it as a plain global), so a cast through `globalThis` lets this test flip it safely —
// same pattern as `apps/mobile/app/(dev)/__tests__/gallery.test.tsx`.
const globalWithDev = globalThis as unknown as { __DEV__: boolean };

describe('fidelityTestId', () => {
  it('returns the fidelity-<screenId> convention', () => {
    expect(fidelityTestId('settings')).toBe('fidelity-settings');
    expect(fidelityTestId('home')).toBe('fidelity-home');
  });

  // Implementation plan for issue #20, Decision 13, Testing Strategy Scenario 21: pins the two
  // literals `scripts/mobile-ui/fidelity-targets.json`'s `ready_test_id` entries depend on, so a
  // change to this helper's convention cannot silently break the fidelity contract's validator.
  it('pins the settings-banks and bank-review ready_test_id literals (issue #20)', () => {
    expect(fidelityTestId('settings-banks')).toBe('fidelity-settings-banks');
    expect(fidelityTestId('bank-review')).toBe('fidelity-bank-review');
  });
});

describe('useFidelityPreview (Decision 9 — release-build inertness)', () => {
  const originalDev = globalWithDev.__DEV__;

  afterEach(() => {
    globalWithDev.__DEV__ = originalDev;
    mockUseLocalSearchParams.mockReset();
  });

  it('returns { active: false, state: null } when __DEV__ is false, even with fidelity=1', () => {
    globalWithDev.__DEV__ = false;
    mockUseLocalSearchParams.mockReturnValue({ fidelity: '1', fidelityState: 'pending' });
    expect(useFidelityPreview()).toEqual({ active: false, state: null });
  });

  it('returns { active: false, state: null } when __DEV__ is true but fidelity param is absent', () => {
    globalWithDev.__DEV__ = true;
    mockUseLocalSearchParams.mockReturnValue({});
    expect(useFidelityPreview()).toEqual({ active: false, state: null });
  });

  it('returns { active: false, state: null } when fidelity is not exactly "1"', () => {
    globalWithDev.__DEV__ = true;
    mockUseLocalSearchParams.mockReturnValue({ fidelity: 'yes' });
    expect(useFidelityPreview()).toEqual({ active: false, state: null });
  });

  it('returns { active: true, state } when __DEV__ is true and fidelity=1 with a state', () => {
    globalWithDev.__DEV__ = true;
    mockUseLocalSearchParams.mockReturnValue({ fidelity: '1', fidelityState: 'all-clear' });
    expect(useFidelityPreview()).toEqual({ active: true, state: 'all-clear' });
  });

  it('returns { active: true, state: null } for a stateless screen (no fidelityState param)', () => {
    globalWithDev.__DEV__ = true;
    mockUseLocalSearchParams.mockReturnValue({ fidelity: '1' });
    expect(useFidelityPreview()).toEqual({ active: true, state: null });
  });
});

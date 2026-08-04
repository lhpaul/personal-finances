import { resolveBackHref, resolveExitHref } from '../flow-navigation';

/** Implementation plan Testing Strategy scenario 12 (AC26, AC27, Business Rule 24). */

describe('resolveBackHref', () => {
  it('returns to the onboarding intro for the onboarding origin', () => {
    expect(resolveBackHref('onboarding')).toBe('/(onboarding)/connect-bank');
  });

  it('returns to settings for the settings origin (AC27)', () => {
    expect(resolveBackHref('settings')).toBe('/settings/banks');
  });
});

describe('resolveExitHref', () => {
  it('continues to notifications for the onboarding origin', () => {
    expect(resolveExitHref('onboarding')).toBe('/(onboarding)/notifications');
  });

  it('returns to settings for the settings origin (AC27)', () => {
    expect(resolveExitHref('settings')).toBe('/settings/banks');
  });
});

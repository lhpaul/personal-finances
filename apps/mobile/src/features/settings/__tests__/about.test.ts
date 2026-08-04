import { ABOUT_LINK_ROWS, resolveAppVersion } from '../about';

/** Scenario 9 of the implementation plan for issue #19: about composition. */
describe('resolveAppVersion (Decision 9)', () => {
  it('reads expoConfig.version when present', () => {
    expect(resolveAppVersion({ expoConfig: { version: '1.2.3' } })).toBe('1.2.3');
  });

  it('falls back to 0.0.0 when expoConfig is absent', () => {
    expect(resolveAppVersion({})).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when expoConfig is null', () => {
    expect(resolveAppVersion({ expoConfig: null })).toBe('0.0.0');
  });

  it('falls back to 0.0.0 when expoConfig.version is absent', () => {
    expect(resolveAppVersion({ expoConfig: {} })).toBe('0.0.0');
  });
});

describe('ABOUT_LINK_ROWS (Decisions 8; Assumption A4)', () => {
  it('has exactly the three mockup rows, in mockup order', () => {
    expect(ABOUT_LINK_ROWS.map((row) => row.titleKey)).toEqual([
      'settings.about.privacy_policy',
      'settings.about.terms',
      'settings.about.feedback',
    ]);
  });

  it('carries no href and no handler field — every row is inert by construction', () => {
    for (const row of ABOUT_LINK_ROWS) {
      expect(Object.keys(row).sort()).toEqual(['iconKey', 'titleKey']);
    }
  });
});

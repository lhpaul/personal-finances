import {
  INTRO_VIEW_STATES,
  resolveIntroState,
  resolveScheduleStep,
  resolveSettingsState,
  SCHEDULE_VIEW_STATES,
  SETTINGS_VIEW_STATES,
} from '../view-state';

describe('resolveIntroState (implementation plan for issue #18, Decision 8, scenario 2)', () => {
  it("'denied' permission resolves to the denied state", () => {
    expect(resolveIntroState('denied')).toBe('denied');
  });

  it.each(['granted', 'undetermined'] as const)('%s permission resolves to the default state', (permission) => {
    expect(resolveIntroState(permission)).toBe('default');
  });

  it('never throws for any PermissionState', () => {
    for (const permission of ['granted', 'denied', 'undetermined'] as const) {
      expect(() => resolveIntroState(permission)).not.toThrow();
    }
  });
});

describe('resolveScheduleStep', () => {
  it.each(SCHEDULE_VIEW_STATES)('resolves %s to itself', (step) => {
    expect(resolveScheduleStep(step)).toBe(step);
  });
});

describe('resolveSettingsState (implementation plan for issue #18, Decision 5, Decision 11)', () => {
  it('enabled intent with a granted permission resolves to enabled', () => {
    expect(resolveSettingsState(true, 'granted')).toBe('enabled');
  });

  it('disabled intent with a granted permission resolves to disabled, without needing a permission change', () => {
    expect(resolveSettingsState(false, 'granted')).toBe('disabled');
  });

  it.each(['denied', 'undetermined'] as const)(
    'enabled intent with a %s permission resolves to disabled — the OS wins',
    (permission) => {
      expect(resolveSettingsState(true, permission)).toBe('disabled');
    },
  );
});

describe('manifest-order view-state tuples (non-negotiable 6)', () => {
  it('declares the exact manifest order for each screen', () => {
    expect(INTRO_VIEW_STATES).toEqual(['default', 'denied']);
    expect(SCHEDULE_VIEW_STATES).toEqual(['time', 'custom-time', 'days']);
    expect(SETTINGS_VIEW_STATES).toEqual(['enabled', 'disabled']);
  });
});

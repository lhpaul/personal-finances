import {
  ONBOARDING_TIME_PRESETS,
  resolvePresetSelection,
  SETTINGS_TIME_PRESETS,
} from '../presets';

describe('resolvePresetSelection (implementation plan for issue #18, Decision 9, scenario 11)', () => {
  it('09:00 selects the morning preset in both tables', () => {
    expect(resolvePresetSelection('09:00', ONBOARDING_TIME_PRESETS)).toEqual({
      kind: 'preset',
      id: 'nine',
    });
    expect(resolvePresetSelection('09:00', SETTINGS_TIME_PRESETS)).toEqual({
      kind: 'preset',
      id: 'morning',
    });
  });

  it('18:00 is the 6:00 PM chip in the onboarding table and custom in the settings table', () => {
    expect(resolvePresetSelection('18:00', ONBOARDING_TIME_PRESETS)).toEqual({
      kind: 'preset',
      id: 'evening',
    });
    expect(resolvePresetSelection('18:00', SETTINGS_TIME_PRESETS)).toEqual({ kind: 'custom' });
  });

  it('19:30 is custom in both tables', () => {
    expect(resolvePresetSelection('19:30', ONBOARDING_TIME_PRESETS)).toEqual({ kind: 'custom' });
    expect(resolvePresetSelection('19:30', SETTINGS_TIME_PRESETS)).toEqual({ kind: 'custom' });
  });

  it('the two tables draw different preset sets (Assumption A11)', () => {
    const onboardingTimes = ONBOARDING_TIME_PRESETS.map((preset) => preset.timeOfDay).sort();
    const settingsTimes = SETTINGS_TIME_PRESETS.map((preset) => preset.timeOfDay).sort();
    expect(onboardingTimes).not.toEqual(settingsTimes);
  });
});

/**
 * Two preset tables, drawn verbatim (implementation plan for issue #18, Decision 9). What is
 * persisted is only `reminder_time` as `"HH:mm"`; which preset appears selected is **derived** at
 * render time by `resolvePresetSelection`, which returns `'custom'` when no preset matches. Labels
 * are not stored here — they are produced at render time by `formatWallClockLabel(timeOfDay)`
 * (item #8, Decision 9) or, for `settings-notifications`'s named presets, by the screen's own
 * `t('settings_notifications.preset_morning' | …)`.
 */

export type ReminderPreset = {
  id: string;
  glyph: string;
  timeOfDay: string;
};

/** `#s-notifications-schedule` (`index.html:1048-1055`). `Personalizada` is not listed here — it
 * has no `timeOfDay` of its own; `TimePresetGrid` renders it as a sibling chip. */
export const ONBOARDING_TIME_PRESETS: ReminderPreset[] = [
  { id: 'morning', glyph: '🌅', timeOfDay: '07:00' },
  { id: 'nine', glyph: '☀️', timeOfDay: '09:00' },
  { id: 'noon', glyph: '🕛', timeOfDay: '12:00' },
  { id: 'evening', glyph: '🌆', timeOfDay: '18:00' },
  { id: 'night', glyph: '🌙', timeOfDay: '20:00' },
];

/** `#s-settings-notifications` (`index.html:2368-2371`) — a different set of three named presets,
 * intentionally distinct from the onboarding table (Decision 9, Assumption A11). */
export const SETTINGS_TIME_PRESETS: ReminderPreset[] = [
  { id: 'morning', glyph: '🌅', timeOfDay: '09:00' },
  { id: 'afternoon', glyph: '☀️', timeOfDay: '14:00' },
  { id: 'evening', glyph: '🌙', timeOfDay: '20:00' },
];

export type PresetSelection = { kind: 'preset'; id: string } | { kind: 'custom' };

/** `resolvePresetSelection('09:00', ONBOARDING_TIME_PRESETS) === { kind: 'preset', id: 'nine' }`;
 * any `timeOfDay` that matches no preset in the table resolves to `{ kind: 'custom' }`. */
export function resolvePresetSelection(timeOfDay: string, presets: ReminderPreset[]): PresetSelection {
  const match = presets.find((preset) => preset.timeOfDay === timeOfDay);
  return match ? { kind: 'preset', id: match.id } : { kind: 'custom' };
}

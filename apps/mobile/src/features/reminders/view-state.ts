import type { PermissionState } from '../../lib/notifications';
import type { PresetSelection } from './presets';

/**
 * One pure resolver per screen, each over real inputs (implementation plan for issue #18,
 * Decision 8). `VIEW_STATES` is the manifest-order tuple `view-state-manifest-parity.test.ts`
 * asserts against — this is what makes "every declared state is implemented" mechanical.
 */

export const INTRO_VIEW_STATES = ['default', 'denied'] as const;
export type IntroViewState = (typeof INTRO_VIEW_STATES)[number];

/** `granted` and `undetermined` both render the `default` frame — only a `denied` OS answer is a
 * distinct state (`#screen=notifications-intro`, Decision 6, Decision 11's spirit). */
export function resolveIntroState(permission: PermissionState): IntroViewState {
  return permission === 'denied' ? 'denied' : 'default';
}

export const SCHEDULE_VIEW_STATES = ['time', 'custom-time', 'days'] as const;
export type ScheduleStep = (typeof SCHEDULE_VIEW_STATES)[number];

/** The schedule screen's step is already the state — `notifications-schedule` has no other input
 * that changes which frame renders (the `custom-time` sub-state is entered explicitly by tapping
 * "Personalizada", not derived from `selection` — the parameter is accepted for callers that
 * already resolved a `PresetSelection` and want a single call site, but it is not consulted here:
 * a person can pick a preset while still on the `custom-time` step without the frame changing
 * (Decision 9, Decision 10) — only the "Personalizada" chip / "Continuar" presses (Decision 8)
 * change `step`. */
export function resolveScheduleStep(step: ScheduleStep, _selection?: PresetSelection): ScheduleStep {
  return step;
}

export const SETTINGS_VIEW_STATES = ['enabled', 'disabled'] as const;
export type SettingsViewState = (typeof SETTINGS_VIEW_STATES)[number];

/** The OS wins (Decision 5): `disabled` whenever the permission is not `granted`, regardless of
 * the stored `reminder_enabled` intent — a revoked permission always shows as `disabled`, and
 * intent off with a granted permission also shows as `disabled` (Decision 11's two-reason table),
 * just without the system note (a decision the *screen*, not this resolver, makes). */
export function resolveSettingsState(enabled: boolean, permission: PermissionState): SettingsViewState {
  return enabled && permission === 'granted' ? 'enabled' : 'disabled';
}

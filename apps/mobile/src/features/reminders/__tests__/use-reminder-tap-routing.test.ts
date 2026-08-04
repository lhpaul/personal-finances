import { handleReminderTap, type HandleReminderTapDeps } from '../use-reminder-tap-routing';

/**
 * `handleReminderTap` — the pure decision extracted from `useReminderTapRouting` (implementation
 * plan for issue #18, Decision 15; mirrors `use-wipe-local-data.ts`'s `attemptConfirmDelete`
 * precedent). Testable with no renderer, no `expo-router`, no `expo-notifications`.
 */
describe('handleReminderTap', () => {
  type Recorder = {
    handled: { identifier: string; date: number }[];
    navigated: number;
    hasHandled: HandleReminderTapDeps['hasHandled'];
    markHandled: HandleReminderTapDeps['markHandled'];
    navigate: HandleReminderTapDeps['navigate'];
  };

  function makeRecorder(): Recorder {
    const recorder: Recorder = {
      handled: [],
      navigated: 0,
      hasHandled: (candidate) =>
        recorder.handled.some((h) => h.identifier === candidate.identifier && h.date === candidate.date),
      markHandled: (candidate) => {
        recorder.handled.push(candidate);
      },
      navigate: () => {
        recorder.navigated += 1;
      },
    };
    return recorder;
  }

  const OWNED_EVENT = { identifier: 'finanzas-reminder-w1', date: 1000 };

  it('navigates for an owned identifier outside onboarding', () => {
    const recorder = makeRecorder();

    handleReminderTap({ event: OWNED_EVENT, pathname: '/home', ...recorder });

    expect(recorder.navigated).toBe(1);
  });

  it('does not navigate for an identifier this app does not own', () => {
    const recorder = makeRecorder();

    handleReminderTap({
      event: { identifier: 'some-other-feature-1', date: 1000 },
      pathname: '/home',
      ...recorder,
    });

    expect(recorder.navigated).toBe(0);
  });

  it.each([
    '/intro',
    '/value',
    '/connect-bank',
    '/bank-picker',
    '/bank-credentials',
    '/bank-syncing',
    '/bank-connected',
    '/notifications',
    '/notifications/schedule',
    '/ready',
  ])('does not navigate while the person is on the onboarding pathname %s', (pathname) => {
    const recorder = makeRecorder();

    handleReminderTap({ event: OWNED_EVENT, pathname, ...recorder });

    expect(recorder.navigated).toBe(0);
  });

  it('marks the event handled even when the onboarding guard suppresses navigation', () => {
    const recorder = makeRecorder();

    handleReminderTap({ event: OWNED_EVENT, pathname: '/intro', ...recorder });

    expect(recorder.handled).toEqual([OWNED_EVENT]);
  });

  it('a duplicate event (same identifier and date) navigates only once — cold-start/listener de-duplication', () => {
    const recorder = makeRecorder();

    handleReminderTap({ event: OWNED_EVENT, pathname: '/home', ...recorder }); // cold-start read
    handleReminderTap({ event: OWNED_EVENT, pathname: '/home', ...recorder }); // listener sees the same event

    expect(recorder.navigated).toBe(1);
  });

  it('a different event (same identifier, different date) is not treated as a duplicate', () => {
    const recorder = makeRecorder();

    handleReminderTap({ event: OWNED_EVENT, pathname: '/home', ...recorder });
    handleReminderTap({ event: { identifier: OWNED_EVENT.identifier, date: 2000 }, pathname: '/home', ...recorder });

    expect(recorder.navigated).toBe(2);
  });
});

import { addDays, deriveDateLocal, formatTimeOfDay } from '@finanzas/shared-utils';

import { describeSyncTime } from '../relative-time';

/** Scenario 15 of the home-screen implementation plan's Testing Strategy (Assumption A11). */
describe('describeSyncTime', () => {
  it('classifies less than 60 minutes as "minutes"', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date('2026-02-15T11:55:00.000Z');
    expect(describeSyncTime(now, then.toISOString())).toEqual({ kind: 'minutes', minutes: 5 });
  });

  it('treats a future instant (clock skew) as zero minutes rather than negative', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date('2026-02-15T12:05:00.000Z');
    expect(describeSyncTime(now, then.toISOString())).toEqual({ kind: 'minutes', minutes: 0 });
  });

  it('classifies a same-local-day gap of an hour or more as "hours"', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date('2026-02-15T09:30:00.000Z');
    // Assert the precondition (via the same Intl-backed helper the module uses) instead of
    // branching on it — a silently-skipped assertion is worse than a loud failure if a future
    // change to these fixed instants (or the host's tz data) breaks the "same local day"
    // assumption (found in review).
    expect(deriveDateLocal(now)).toBe(deriveDateLocal(then));
    expect(describeSyncTime(now, then.toISOString())).toEqual({ kind: 'hours', hours: 2 });
  });

  it('classifies the previous local calendar day as "yesterday", with its time of day', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(deriveDateLocal(then)).toBe(addDays(deriveDateLocal(now), -1));
    expect(describeSyncTime(now, then.toISOString())).toEqual({
      kind: 'yesterday',
      timeOfDay: formatTimeOfDay(then),
    });
  });

  it('classifies an older instant as "date", carrying its resolved local date', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date('2026-01-01T00:00:00.000Z');
    expect(describeSyncTime(now, then.toISOString())).toEqual({
      kind: 'date',
      dateLocal: deriveDateLocal(then),
    });
  });

  it('never throws and resolves deterministically near Chile\'s DST transition window (found in review: assert the exact kind, not just union membership)', () => {
    // Chile's typical "fall back" transition sits in early April; regardless of the exact date
    // observed this year (Chile has changed its own DST law more than once), the classifier must
    // not throw and must resolve deterministically. Rather than hardcoding a real-world UTC
    // offset this test cannot reliably know in advance, each expectation is computed from the
    // same two primitives describeSyncTime itself is documented to use — elapsed milliseconds
    // for the minutes/hours tiers, deriveDateLocal for the day comparison — so a regression to
    // wall-clock/UTC-day arithmetic (the exact bug class this test guards against) still fails
    // it, without the test asserting a guessed offset.
    const now = new Date('2026-04-05T15:00:00.000Z');
    const instants = [
      '2026-04-05T14:50:00.000Z',
      '2026-04-05T10:00:00.000Z',
      '2026-04-04T18:00:00.000Z',
      '2026-03-20T00:00:00.000Z',
    ];

    for (const iso of instants) {
      const then = new Date(iso);
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60_000));
      const nowDateLocal = deriveDateLocal(now);
      const thenDateLocal = deriveDateLocal(then);

      let expected: ReturnType<typeof describeSyncTime>;
      if (elapsedMinutes < 60) {
        expected = { kind: 'minutes', minutes: elapsedMinutes };
      } else if (thenDateLocal === nowDateLocal) {
        expected = { kind: 'hours', hours: Math.floor(elapsedMinutes / 60) };
      } else if (thenDateLocal === addDays(nowDateLocal, -1)) {
        expected = { kind: 'yesterday', timeOfDay: formatTimeOfDay(then) };
      } else {
        expected = { kind: 'date', dateLocal: thenDateLocal };
      }

      expect(describeSyncTime(now, iso)).toEqual(expected);
    }
  });
});

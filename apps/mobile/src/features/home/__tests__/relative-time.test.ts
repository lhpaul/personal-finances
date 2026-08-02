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
    // Guard on the real local-day comparison (via the same Intl-backed helper the module uses)
    // rather than assuming a fixed UTC offset — this is what keeps the test DST-agnostic.
    if (deriveDateLocal(now) === deriveDateLocal(then)) {
      expect(describeSyncTime(now, then.toISOString())).toEqual({ kind: 'hours', hours: 2 });
    }
  });

  it('classifies the previous local calendar day as "yesterday", with its time of day', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (deriveDateLocal(then) === addDays(deriveDateLocal(now), -1)) {
      expect(describeSyncTime(now, then.toISOString())).toEqual({
        kind: 'yesterday',
        timeOfDay: formatTimeOfDay(then),
      });
    }
  });

  it('classifies an older instant as "date", carrying its resolved local date', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const then = new Date('2026-01-01T00:00:00.000Z');
    expect(describeSyncTime(now, then.toISOString())).toEqual({
      kind: 'date',
      dateLocal: deriveDateLocal(then),
    });
  });

  it('never throws and always returns one of the four documented kinds near Chile\'s DST transition window', () => {
    // Chile's typical "fall back" transition sits in early April; regardless of the exact date
    // observed this year, the classifier must not throw and must resolve deterministically —
    // it never does wall-clock hour arithmetic across the boundary, only real elapsed
    // milliseconds plus deriveDateLocal's Intl-backed day comparison.
    const now = new Date('2026-04-05T15:00:00.000Z');
    const instants = [
      '2026-04-05T14:50:00.000Z',
      '2026-04-05T10:00:00.000Z',
      '2026-04-04T18:00:00.000Z',
      '2026-03-20T00:00:00.000Z',
    ];
    for (const iso of instants) {
      const result = describeSyncTime(now, iso);
      expect(['minutes', 'hours', 'yesterday', 'date']).toContain(result.kind);
    }
  });
});

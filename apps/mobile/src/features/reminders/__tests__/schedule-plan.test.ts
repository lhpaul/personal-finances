import type { IsoWeekday, PermissionState } from '../../../lib/notifications';
import { planReminderSchedule, reminderIdentifier, type PlanReminderScheduleInput } from '../schedule-plan';

const BASE: PlanReminderScheduleInput = {
  enabled: true,
  permission: 'granted',
  time: '09:00',
  days: [1, 2, 3, 4, 5],
  title: 'Desafío diario',
  body: 'Categoriza tus gastos de hoy.',
};

describe('planReminderSchedule (implementation plan for issue #18, Decisions 2, 3, 5)', () => {
  it('schedules exactly the selected days at the selected time (scenario 3)', () => {
    const plan = planReminderSchedule(BASE);
    expect(plan.map((request) => request.identifier)).toEqual([
      'finanzas-reminder-w1',
      'finanzas-reminder-w2',
      'finanzas-reminder-w3',
      'finanzas-reminder-w4',
      'finanzas-reminder-w5',
    ]);
    for (const request of plan) {
      expect(request.trigger).toMatchObject({ kind: 'weekly', hour: 9, minute: 0 });
    }
  });

  it('is stable across two calls with the same input', () => {
    expect(planReminderSchedule(BASE)).toEqual(planReminderSchedule(BASE));
  });

  it.each<[string, Partial<PlanReminderScheduleInput>]>([
    ['intent off', { enabled: false }],
    ['permission denied', { permission: 'denied' as PermissionState }],
    ['permission undetermined', { permission: 'undetermined' as PermissionState }],
    ['empty day set', { days: [] }],
  ])('returns [] when %s (scenario 4)', (_label, overrides) => {
    expect(planReminderSchedule({ ...BASE, ...overrides })).toEqual([]);
  });

  it('weekly-per-day: all seven days yields seven weekly requests (scenario 5)', () => {
    const plan = planReminderSchedule({ ...BASE, days: [1, 2, 3, 4, 5, 6, 7], strategy: 'weekly-per-day' });
    expect(plan).toHaveLength(7);
    expect(plan.every((request) => request.trigger.kind === 'weekly')).toBe(true);
  });

  it('daily-when-every-day: all seven days collapses into a single daily trigger (scenario 5)', () => {
    const plan = planReminderSchedule({
      ...BASE,
      days: [1, 2, 3, 4, 5, 6, 7],
      strategy: 'daily-when-every-day',
    });
    expect(plan).toEqual([
      {
        identifier: 'finanzas-reminder-daily',
        title: BASE.title,
        body: BASE.body,
        trigger: { kind: 'daily', hour: 9, minute: 0 },
      },
    ]);
  });

  it('a six-day selection yields six weekly requests under both strategies (scenario 5)', () => {
    const days: IsoWeekday[] = [1, 2, 3, 4, 5, 6];
    const weekly = planReminderSchedule({ ...BASE, days, strategy: 'weekly-per-day' });
    const daily = planReminderSchedule({ ...BASE, days, strategy: 'daily-when-every-day' });
    expect(weekly).toHaveLength(6);
    expect(daily).toHaveLength(6);
    expect(weekly.every((request) => request.trigger.kind === 'weekly')).toBe(true);
    expect(daily.every((request) => request.trigger.kind === 'weekly')).toBe(true);
  });

  it('de-duplicates and sorts an unsorted, duplicated day list', () => {
    const plan = planReminderSchedule({ ...BASE, days: [5, 1, 1, 3] as IsoWeekday[] });
    expect(plan.map((request) => request.identifier)).toEqual([
      'finanzas-reminder-w1',
      'finanzas-reminder-w3',
      'finanzas-reminder-w5',
    ]);
  });

  it('throws RangeError on a malformed time string', () => {
    expect(() => planReminderSchedule({ ...BASE, time: '9am' })).toThrow(RangeError);
  });
});

describe('reminderIdentifier (Decision 2)', () => {
  it('derives a deterministic weekly identifier from the ISO weekday', () => {
    expect(reminderIdentifier({ kind: 'weekly', isoWeekday: 1, hour: 9, minute: 0 })).toBe(
      'finanzas-reminder-w1',
    );
    expect(reminderIdentifier({ kind: 'weekly', isoWeekday: 7, hour: 9, minute: 0 })).toBe(
      'finanzas-reminder-w7',
    );
  });

  it('derives the fixed daily identifier regardless of time', () => {
    expect(reminderIdentifier({ kind: 'daily', hour: 9, minute: 0 })).toBe('finanzas-reminder-daily');
    expect(reminderIdentifier({ kind: 'daily', hour: 20, minute: 30 })).toBe('finanzas-reminder-daily');
  });
});

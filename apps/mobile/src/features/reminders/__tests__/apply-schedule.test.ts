import { createMemoryNotificationsPort } from '../../../lib/notifications/testing/memory-notifications';
import type { ReminderRequest } from '../../../lib/notifications';
import { applyReminderSchedule } from '../apply-schedule';

function weeklyRequest(isoWeekday: number, hour: number, minute: number): ReminderRequest {
  return {
    identifier: `finanzas-reminder-w${isoWeekday}`,
    title: 'Desafío diario',
    body: 'Categoriza tus gastos de hoy.',
    trigger: { kind: 'weekly', isoWeekday: isoWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7, hour, minute },
  };
}

describe('applyReminderSchedule (implementation plan for issue #18, Decision 2, scenarios 6-7)', () => {
  it('applying the same plan twice converges to the same identifier set with no duplicates', async () => {
    const port = createMemoryNotificationsPort('granted');
    const planA = [weeklyRequest(1, 9, 0), weeklyRequest(2, 9, 0)];

    const firstResult = await applyReminderSchedule(port, planA, 'Recordatorios');
    const secondResult = await applyReminderSchedule(port, planA, 'Recordatorios');

    expect(firstResult.sort()).toEqual(['finanzas-reminder-w1', 'finanzas-reminder-w2']);
    expect(secondResult.sort()).toEqual(['finanzas-reminder-w1', 'finanzas-reminder-w2']);
    expect(Array.from(port.scheduled.keys()).sort()).toEqual(['finanzas-reminder-w1', 'finanzas-reminder-w2']);
  });

  it('a changed plan replaces the previous one entirely — a time change reschedules, not duplicates', async () => {
    const port = createMemoryNotificationsPort('granted');
    const planA = [weeklyRequest(1, 9, 0)];
    const planB = [weeklyRequest(1, 20, 0)]; // same weekday, different time — same identifier

    await applyReminderSchedule(port, planA, 'Recordatorios');
    await applyReminderSchedule(port, planB, 'Recordatorios');

    expect(port.scheduled.size).toBe(1);
    expect(port.scheduled.get('finanzas-reminder-w1')?.trigger).toMatchObject({ hour: 20, minute: 0 });
  });

  it('every cancel precedes every schedule, on every application (call-log ordering)', async () => {
    const port = createMemoryNotificationsPort('granted');
    await applyReminderSchedule(port, [weeklyRequest(1, 9, 0)], 'Recordatorios');
    port.callLog.length = 0; // reset to observe only the second application's ordering

    await applyReminderSchedule(port, [weeklyRequest(2, 9, 0)], 'Recordatorios');

    const cancelIndex = port.callLog.findIndex((entry) => entry.kind === 'cancel');
    const scheduleIndex = port.callLog.findIndex((entry) => entry.kind === 'schedule');
    expect(cancelIndex).toBeGreaterThanOrEqual(0);
    expect(scheduleIndex).toBeGreaterThan(cancelIndex);
  });

  it('an empty plan cancels every owned identifier and schedules nothing', async () => {
    const port = createMemoryNotificationsPort('granted');
    await applyReminderSchedule(port, [weeklyRequest(1, 9, 0)], 'Recordatorios');

    const result = await applyReminderSchedule(port, [], 'Recordatorios');

    expect(result).toEqual([]);
    expect(port.scheduled.size).toBe(0);
  });

  it('a foreign identifier (not owned by this app) survives every application (scenario 7)', async () => {
    const port = createMemoryNotificationsPort('granted');
    port.scheduled.set('some-other-feature-1', {
      identifier: 'some-other-feature-1',
      title: 'x',
      body: 'y',
      trigger: { kind: 'daily', hour: 1, minute: 0 },
    });

    await applyReminderSchedule(port, [weeklyRequest(1, 9, 0)], 'Recordatorios');

    expect(port.scheduled.has('some-other-feature-1')).toBe(true);
    expect(port.scheduled.has('finanzas-reminder-w1')).toBe(true);
  });

  it('prepares the channel only when there is something to schedule', async () => {
    const port = createMemoryNotificationsPort('granted');
    await applyReminderSchedule(port, [], 'Recordatorios');
    expect(port.channelPrepared).toBe(false);

    await applyReminderSchedule(port, [weeklyRequest(1, 9, 0)], 'Recordatorios');
    expect(port.channelPrepared).toBe(true);
  });
});

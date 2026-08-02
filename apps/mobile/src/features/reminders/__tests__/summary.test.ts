import { summarizeReminderDays } from '../summary';

/** Testing Strategy scenario 8. */
describe('summarizeReminderDays', () => {
  it('[1,2,3,4,5] -> weekdays', () => {
    expect(summarizeReminderDays([1, 2, 3, 4, 5])).toEqual({ kind: 'weekdays' });
  });

  it('[1..7] -> everyday', () => {
    expect(summarizeReminderDays([1, 2, 3, 4, 5, 6, 7])).toEqual({ kind: 'everyday' });
  });

  it('[6,7] -> custom', () => {
    expect(summarizeReminderDays([6, 7])).toEqual({ kind: 'custom', days: [6, 7] });
  });

  it('[] -> custom with no days', () => {
    expect(summarizeReminderDays([])).toEqual({ kind: 'custom', days: [] });
  });

  it('unordered/duplicate input is normalized before comparison', () => {
    expect(summarizeReminderDays([5, 1, 3, 4, 2, 1])).toEqual({ kind: 'weekdays' });
    expect(summarizeReminderDays([7, 6, 6])).toEqual({ kind: 'custom', days: [6, 7] });
  });

  it('a near-miss of weekdays (missing one day) is custom, not weekdays', () => {
    expect(summarizeReminderDays([1, 2, 3, 4])).toEqual({ kind: 'custom', days: [1, 2, 3, 4] });
  });
});

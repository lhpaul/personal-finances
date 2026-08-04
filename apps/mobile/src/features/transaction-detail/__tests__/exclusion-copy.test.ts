import { DETAIL_EXCLUSION_REASONS, exclusionReasonKey } from '../exclusion-copy';

/** `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 16 (Decision 5, A3). */
describe('DETAIL_EXCLUSION_REASONS', () => {
  it('is exactly the four drawn reasons, in the drawn order', () => {
    expect(DETAIL_EXCLUSION_REASONS).toEqual(['personal_transfer', 'shared_expense', 'not_relevant', 'other']);
  });

  it('does not include cash_withdrawal — reachable only from the categorization flow (A3)', () => {
    expect(DETAIL_EXCLUSION_REASONS).not.toContain('cash_withdrawal');
  });
});

describe('exclusionReasonKey', () => {
  it('maps all five stored values to a catalogue key', () => {
    expect(exclusionReasonKey('personal_transfer')).toBe('transaction_detail.reason_personal_transfer');
    expect(exclusionReasonKey('shared_expense')).toBe('transaction_detail.reason_shared_expense');
    expect(exclusionReasonKey('not_relevant')).toBe('transaction_detail.reason_not_relevant');
    expect(exclusionReasonKey('cash_withdrawal')).toBe('transaction_detail.reason_cash_withdrawal');
    expect(exclusionReasonKey('other')).toBe('transaction_detail.reason_other');
  });
});

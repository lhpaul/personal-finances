import { formatProductLabel } from '../product-label';

/** `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 15 (A9). */
describe('formatProductLabel', () => {
  it('renders "{name} ••{mask}" when a mask is present', () => {
    expect(formatProductLabel({ name: 'Cta. corriente', mask: '4821' })).toBe('Cta. corriente ••4821');
  });

  it('renders the bare name when there is no mask', () => {
    expect(formatProductLabel({ name: 'Cta. corriente', mask: undefined })).toBe('Cta. corriente');
  });
});

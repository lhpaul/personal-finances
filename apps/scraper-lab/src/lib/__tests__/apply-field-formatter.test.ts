import { formatRut } from '@finanzas/shared-utils';

import { applyFieldFormatter } from '../apply-field-formatter';

describe('applyFieldFormatter', () => {
  it('returns the value unchanged when there is no formatter', () => {
    expect(applyFieldFormatter(undefined, 'abc')).toBe('abc');
  });

  it('formats a structurally complete RUT', () => {
    expect(applyFieldFormatter(formatRut, '123456785')).toBe('12.345.678-5');
  });

  it('keeps the raw input while the RUT is still incomplete', () => {
    expect(applyFieldFormatter(formatRut, '12')).toBe('12');
    expect(applyFieldFormatter(formatRut, '')).toBe('');
  });
});

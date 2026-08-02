import { resolveBankConfigOrReject } from '../engine/scrape-session';
import { BANK_CONFIGS } from './index';
import { CL_BANKS } from './cl';

describe('BANK_CONFIGS registry — AC28: exactly one bank for Chile', () => {
  it('lists exactly one Chilean bank, banco-de-chile', () => {
    expect(CL_BANKS).toHaveLength(1);
    expect(CL_BANKS[0]?.id).toBe('banco-de-chile');
  });

  it('the registry exposes cl as the only country key with data', () => {
    expect(BANK_CONFIGS.cl).toBe(CL_BANKS);
  });
});

describe('BANK_CONFIGS registry — AC18: refusal for an unsupported bank or country', () => {
  it('refuses an unsupported country', () => {
    const result = resolveBankConfigOrReject(BANK_CONFIGS, 'ar', 'banco-de-chile');
    expect(result).toEqual({ reason: 'unsupported_country', countryCode: 'ar', bankId: 'banco-de-chile' });
  });

  it('refuses an unsupported bank id within a supported country', () => {
    const result = resolveBankConfigOrReject(BANK_CONFIGS, 'cl', 'not-a-real-bank');
    expect(result).toEqual({ reason: 'unsupported_bank', countryCode: 'cl', bankId: 'not-a-real-bank' });
  });

  it('resolves banco-de-chile in cl to its real config', () => {
    const result = resolveBankConfigOrReject(BANK_CONFIGS, 'cl', 'banco-de-chile');
    expect(result).not.toHaveProperty('reason');
    expect((result as { id: string }).id).toBe('banco-de-chile');
  });
});

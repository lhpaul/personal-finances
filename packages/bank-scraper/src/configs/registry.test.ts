import { resolveBankConfigOrReject } from '../engine/scrape-session';
import { BANK_CONFIGS } from './index';
import { CL_BANKS } from './cl';

describe('BANK_CONFIGS registry', () => {
  it('lists the three Chilean banks with unique ids', () => {
    expect(CL_BANKS.map((bank) => bank.id).sort()).toEqual([
      'banco-de-chile',
      'banco-pelotillehue',
      'falabella',
    ]);
    expect(new Set(CL_BANKS.map((bank) => bank.id)).size).toBe(CL_BANKS.length);
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

  it('resolves falabella and banco-pelotillehue', () => {
    expect(resolveBankConfigOrReject(BANK_CONFIGS, 'cl', 'falabella')).not.toHaveProperty('reason');
    expect(resolveBankConfigOrReject(BANK_CONFIGS, 'cl', 'banco-pelotillehue')).not.toHaveProperty('reason');
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'refuses the inherited Object.prototype key %s as an unsupported country, rather than throwing (CodeRabbit finding #23)',
    (countryCode) => {
      expect(() => resolveBankConfigOrReject(BANK_CONFIGS, countryCode, 'banco-de-chile')).not.toThrow();
      const result = resolveBankConfigOrReject(BANK_CONFIGS, countryCode, 'banco-de-chile');
      expect(result).toEqual({ reason: 'unsupported_country', countryCode, bankId: 'banco-de-chile' });
    },
  );
});

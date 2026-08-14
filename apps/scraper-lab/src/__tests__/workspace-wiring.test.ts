import { BANK_CONFIGS, PACKAGE_NAME as BANK_SCRAPER_PACKAGE_NAME } from '@finanzas/bank-scraper';

describe('scraper-lab workspace wiring', () => {
  it('consumes @finanzas/bank-scraper', () => {
    expect(BANK_SCRAPER_PACKAGE_NAME).toBe('@finanzas/bank-scraper');
  });

  it('lists all three lab banks from the shared registry', () => {
    expect(BANK_CONFIGS.cl?.map((bank) => bank.id).sort()).toEqual([
      'banco-de-chile',
      'banco-pelotillehue',
      'falabella',
    ]);
  });
});

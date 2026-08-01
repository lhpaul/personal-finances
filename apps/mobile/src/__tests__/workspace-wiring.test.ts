import { PACKAGE_NAME as BANK_SCRAPER_PACKAGE_NAME } from '@finanzas/bank-scraper';
import { PACKAGE_NAME as SHARED_DOMAIN_PACKAGE_NAME } from '@finanzas/shared-domain';
import { PACKAGE_NAME as SHARED_UTILS_PACKAGE_NAME } from '@finanzas/shared-utils';

/**
 * Proves the app consumes code from all three shared packages through `workspace:*` +
 * Metro/Jest resolution (spec AC3).
 */
describe('workspace wiring', () => {
  it('consumes @finanzas/shared-domain', () => {
    expect(SHARED_DOMAIN_PACKAGE_NAME).toBe('@finanzas/shared-domain');
  });

  it('consumes @finanzas/shared-utils', () => {
    expect(SHARED_UTILS_PACKAGE_NAME).toBe('@finanzas/shared-utils');
  });

  it('consumes @finanzas/bank-scraper', () => {
    expect(BANK_SCRAPER_PACKAGE_NAME).toBe('@finanzas/bank-scraper');
  });
});

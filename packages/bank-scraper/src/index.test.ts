import { PACKAGE_NAME } from './index';

describe('@finanzas/bank-scraper', () => {
  it('exposes its own package name', () => {
    expect(PACKAGE_NAME).toBe('@finanzas/bank-scraper');
  });
});

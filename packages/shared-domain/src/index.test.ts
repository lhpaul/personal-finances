import { PACKAGE_NAME } from './index';

describe('@finanzas/shared-domain', () => {
  it('exposes its own package name', () => {
    expect(PACKAGE_NAME).toBe('@finanzas/shared-domain');
  });
});

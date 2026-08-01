import { PACKAGE_NAME } from './index';

describe('@finanzas/shared-utils', () => {
  it('exposes its own package name', () => {
    expect(PACKAGE_NAME).toBe('@finanzas/shared-utils');
  });
});

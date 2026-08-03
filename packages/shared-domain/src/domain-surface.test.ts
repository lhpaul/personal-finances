/**
 * Exported-surface guard (AC3; Business Rules 0, 1, 2). `@finanzas/shared-domain` has no
 * identity, session, credential or clock surface: the profile is the device, credentials never
 * leave it, and there is one RUT per user living in `expo-secure-store` — none of which this
 * package has any business naming.
 *
 * Runtime reflection can only see values, not erased TypeScript types (a type named
 * `Credential` would not be caught here) — the smoke runbook's Step 6 `grep` covers type and
 * field names as the required complement to this test.
 */
const FORBIDDEN_NAME_PATTERN = /password|credential|secret|token|session|auth|\brut\b/i;

describe('domain-surface — exported-surface guard', () => {
  it('no export name matches a credential/identity/session pattern', async () => {
    const domainIndex = await import('./index');
    const offendingNames = Object.keys(domainIndex).filter((name) => FORBIDDEN_NAME_PATTERN.test(name));
    expect(offendingNames).toEqual([]);
  });

  it('exports at least the real, expected surface (negative-control sanity check)', async () => {
    const domainIndex = await import('./index');
    expect(domainIndex).toHaveProperty('isIncludedInAnalysis');
    expect(domainIndex).toHaveProperty('summarizePeriod');
    expect(domainIndex).toHaveProperty('apportionTenths');
    expect(domainIndex).toHaveProperty('resolveMerchant');
    expect(domainIndex).toHaveProperty('suggestAliasCandidates');
    expect(domainIndex).toHaveProperty('suggestCategory');
    expect(domainIndex).toHaveProperty('PACKAGE_NAME');
  });
});

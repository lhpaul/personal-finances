import { assertCredentialEntryAllowed, isAllowedOrigin } from './origin-allowlist';

const BANCO_DE_CHILE_ORIGIN = 'https://login.portales.bancochile.cl';

describe('isAllowedOrigin', () => {
  const allowedCases: readonly string[] = [
    'https://login.portales.bancochile.cl/login',
    'https://login.portales.bancochile.cl/login?next=%2Fhome',
    'https://LOGIN.PORTALES.BANCOCHILE.CL/login',
    'https://login.portales.bancochile.cl:443/login',
  ];

  it.each(allowedCases)('allows %s', (url) => {
    expect(isAllowedOrigin(url, [BANCO_DE_CHILE_ORIGIN])).toBe(true);
  });

  const rejectedCases: ReadonlyArray<[string, string]> = [
    ['suffix lookalike', 'https://login.portales.bancochile.cl.evil.example/login'],
    ['sibling subdomain', 'https://portales.bancochile.cl/login'],
    ['userinfo trick', 'https://login.portales.bancochile.cl@evil.example/login'],
    ['http downgrade', 'http://login.portales.bancochile.cl/login'],
    ['idn homograph', 'https://xn--bancochile-lookalike.example/login'],
    ['unparseable', 'not a url'],
    // No-dot-boundary hostname: the last characters of this hostname literally spell the
    // allowed hostname, but preceded by a hyphen rather than a dot — a plain
    // `hostname.endsWith(allowedHostname)` comparison would wrongly accept this. `URL.origin`
    // equality rejects it because the *whole* origin, not a trailing substring, must match.
    ['no-dot-boundary suffix', 'https://evil-login.portales.bancochile.cl/login'],
  ];

  it.each(rejectedCases)('rejects %s: %s', (_label, url) => {
    expect(isAllowedOrigin(url, [BANCO_DE_CHILE_ORIGIN])).toBe(false);
  });

  it('rejects an origin not in the allowlist even when the URL is well-formed https', () => {
    expect(isAllowedOrigin('https://example.com/', [BANCO_DE_CHILE_ORIGIN])).toBe(false);
  });

  it('does not over-fire: a real read is possible through this allowlist', () => {
    // The AC1 happy path in scrape-session.test.ts drives a full read entirely through allowed
    // URLs; this assertion is the unit-level half of "does not over-fire" for this file alone.
    expect(isAllowedOrigin(`${BANCO_DE_CHILE_ORIGIN}/login`, [BANCO_DE_CHILE_ORIGIN])).toBe(true);
  });
});

describe('assertCredentialEntryAllowed', () => {
  it('allows the credential-entry origin and reports no blocked/expected fields', () => {
    const result = assertCredentialEntryAllowed(`${BANCO_DE_CHILE_ORIGIN}/login`, BANCO_DE_CHILE_ORIGIN);
    expect(result).toEqual({ allowed: true });
  });

  it('rejects a redirect off-origin and reports only the origins, never the full URL', () => {
    const result = assertCredentialEntryAllowed(
      'https://login.portales.bancochile.cl.evil.example/login?session=abc123',
      BANCO_DE_CHILE_ORIGIN,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('https://login.portales.bancochile.cl.evil.example');
    expect(result.expectedOrigin).toBe(BANCO_DE_CHILE_ORIGIN);
    // Never the full URL — the path/query must not appear anywhere in the reported fields.
    expect(JSON.stringify(result)).not.toContain('session=abc123');
  });

  it('rejects a lookalike hostname', () => {
    const result = assertCredentialEntryAllowed('https://bancochile-cl.example/login', BANCO_DE_CHILE_ORIGIN);
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('https://bancochile-cl.example');
  });

  it('reports "unparseable" for a blockedOrigin that cannot be parsed as a URL', () => {
    const result = assertCredentialEntryAllowed('not a url', BANCO_DE_CHILE_ORIGIN);
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('unparseable');
  });
});

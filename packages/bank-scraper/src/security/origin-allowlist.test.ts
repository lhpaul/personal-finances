import { assertCredentialEntryAllowed, isAllowedOrigin } from './origin-allowlist';

// A representative bank sign-in origin — this file tests the bank-agnostic allowlist function
// itself, so it deliberately does not reference any registered bank's real origin (see
// testing/bank-containment.test.ts, which enforces that a specific bank's origin lives only
// under its own config directory).
const EXAMPLE_BANK_ORIGIN = 'https://login.example-bank.cl';

describe('isAllowedOrigin', () => {
  const allowedCases: readonly string[] = [
    'https://login.example-bank.cl/login',
    'https://login.example-bank.cl/login?next=%2Fhome',
    'https://LOGIN.EXAMPLE-BANK.CL/login',
    'https://login.example-bank.cl:443/login',
  ];

  it.each(allowedCases)('allows %s', (url) => {
    expect(isAllowedOrigin(url, [EXAMPLE_BANK_ORIGIN])).toBe(true);
  });

  const rejectedCases: ReadonlyArray<[string, string]> = [
    ['suffix lookalike', 'https://login.example-bank.cl.evil.example/login'],
    ['sibling subdomain', 'https://example-bank.cl/login'],
    ['userinfo trick', 'https://login.example-bank.cl@evil.example/login'],
    ['http downgrade', 'http://login.example-bank.cl/login'],
    ['idn homograph', 'https://xn--example-bank-lookalike.example/login'],
    ['unparseable', 'not a url'],
    // No-dot-boundary hostname: the last characters of this hostname literally spell the
    // allowed hostname, but preceded by a hyphen rather than a dot — a plain
    // `hostname.endsWith(allowedHostname)` comparison would wrongly accept this. `URL.origin`
    // equality rejects it because the *whole* origin, not a trailing substring, must match.
    ['no-dot-boundary suffix', 'https://evil-login.example-bank.cl/login'],
  ];

  it.each(rejectedCases)('rejects %s: %s', (_label, url) => {
    expect(isAllowedOrigin(url, [EXAMPLE_BANK_ORIGIN])).toBe(false);
  });

  it('rejects an origin not in the allowlist even when the URL is well-formed https', () => {
    expect(isAllowedOrigin('https://example.com/', [EXAMPLE_BANK_ORIGIN])).toBe(false);
  });

  it('does not over-fire: a real read is possible through this allowlist', () => {
    // The AC1 happy path in scrape-session.test.ts drives a full read entirely through allowed
    // URLs; this assertion is the unit-level half of "does not over-fire" for this file alone.
    expect(isAllowedOrigin(`${EXAMPLE_BANK_ORIGIN}/login`, [EXAMPLE_BANK_ORIGIN])).toBe(true);
  });
});

describe('assertCredentialEntryAllowed', () => {
  it('allows the credential-entry origin and reports no blocked/expected fields', () => {
    const result = assertCredentialEntryAllowed(`${EXAMPLE_BANK_ORIGIN}/login`, EXAMPLE_BANK_ORIGIN);
    expect(result).toEqual({ allowed: true });
  });

  it('rejects a redirect off-origin and reports only the origins, never the full URL', () => {
    const result = assertCredentialEntryAllowed(
      'https://login.example-bank.cl.evil.example/login?session=abc123',
      EXAMPLE_BANK_ORIGIN,
    );
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('https://login.example-bank.cl.evil.example');
    expect(result.expectedOrigin).toBe(EXAMPLE_BANK_ORIGIN);
    // Never the full URL — the path/query must not appear anywhere in the reported fields.
    expect(JSON.stringify(result)).not.toContain('session=abc123');
  });

  it('rejects a lookalike hostname', () => {
    const result = assertCredentialEntryAllowed('https://example-bank-cl.example/login', EXAMPLE_BANK_ORIGIN);
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('https://example-bank-cl.example');
  });

  it('reports "unparseable" for a blockedOrigin that cannot be parsed as a URL', () => {
    const result = assertCredentialEntryAllowed('not a url', EXAMPLE_BANK_ORIGIN);
    expect(result.allowed).toBe(false);
    expect(result.blockedOrigin).toBe('unparseable');
  });
});

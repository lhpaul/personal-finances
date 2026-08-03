/**
 * The exact-origin allowlist (spec Business Rule 5, AC16; implementation plan Decision 4).
 *
 * A credential is typed into the bank's own page and nowhere else, checked against an exact
 * allowlist, never a description of what the page looks like. Comparing `URL.origin` — never
 * `hostname.endsWith(...)`, never `url.includes(...)` — is what makes the check exact:
 * `URL.origin` lower-cases the host, normalizes the default port, drops userinfo, and normalizes
 * an IDN/punycode host to its ASCII form, so a lookalike, a suffix trick, or a userinfo trick all
 * fail to match.
 */

/** `true` only when `url` is `https:` and its origin exactly equals one of `allowedOrigins`. */
export function isAllowedOrigin(url: string, allowedOrigins: readonly string[]): boolean {
  let candidate: URL;
  try {
    candidate = new URL(url);
  } catch {
    return false; // unparseable is never allowed
  }
  if (candidate.protocol !== 'https:') return false;
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === candidate.origin;
    } catch {
      return false;
    }
  });
}

/**
 * The result of an allowlist check that also carries the two values a trace is allowed to
 * report on a violation (Decision 4): `blockedOrigin` and `expectedOrigin`, never the full URL,
 * whose path and query string can carry session-identifying material.
 */
export interface CredentialEntryCheck {
  allowed: boolean;
  blockedOrigin?: string;
  expectedOrigin?: string;
}

/**
 * Checks a URL against the single origin a credential may ever be typed into. Returns the
 * redaction-safe fields for a trace on rejection; never returns or logs the full URL.
 */
export function assertCredentialEntryAllowed(
  url: string,
  credentialEntryOrigin: string,
): CredentialEntryCheck {
  if (isAllowedOrigin(url, [credentialEntryOrigin])) {
    return { allowed: true };
  }
  let blockedOrigin: string;
  try {
    blockedOrigin = new URL(url).origin;
  } catch {
    blockedOrigin = 'unparseable';
  }
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(credentialEntryOrigin).origin;
  } catch {
    expectedOrigin = credentialEntryOrigin;
  }
  return { allowed: false, blockedOrigin, expectedOrigin };
}

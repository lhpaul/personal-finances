import { isAllowedOrigin } from '../../../security/origin-allowlist';
import {
  BANCO_DE_CHILE_ALLOWED_ORIGINS,
  BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN,
} from './banco-de-chile.constants';

describe('Banco de Chile origins', () => {
  it('types credentials only on the login host', () => {
    expect(BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN).toBe('https://login.portales.bancochile.cl');
    expect(BANCO_DE_CHILE_ALLOWED_ORIGINS).not.toEqual([BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN]);
  });

  it('allows the login host and the post-login portal', () => {
    expect(isAllowedOrigin(`${BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN}/login`, BANCO_DE_CHILE_ALLOWED_ORIGINS)).toBe(
      true,
    );
    expect(isAllowedOrigin('https://portalpersonas.bancochile.cl/index.html#/home', BANCO_DE_CHILE_ALLOWED_ORIGINS)).toBe(
      true,
    );
  });

  it('still rejects a sibling lookalike', () => {
    expect(
      isAllowedOrigin('https://login.portales.bancochile.cl.evil.example/login', BANCO_DE_CHILE_ALLOWED_ORIGINS),
    ).toBe(false);
  });
});

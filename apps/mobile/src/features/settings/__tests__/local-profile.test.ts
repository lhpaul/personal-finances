import { buildLocalProfile, formatRutOrRaw } from '../local-profile';

/** Scenario 8 of the implementation plan for issue #19: local profile composition. */
describe('formatRutOrRaw (Decision 5)', () => {
  it('formats a well-formed RUT', () => {
    expect(formatRutOrRaw('123456785')).toBe('12.345.678-5');
  });

  it('falls back to the raw string when formatRut throws on malformed input', () => {
    expect(formatRutOrRaw('not-a-rut')).toBe('not-a-rut');
  });

  it('returns null for null (no credential entry exists)', () => {
    expect(formatRutOrRaw(null)).toBeNull();
  });
});

describe('buildLocalProfile (Decisions 5, 10, 16; Assumption A5)', () => {
  it('formats a valid RUT, and enero 2025 from a January first_launch_at', () => {
    const result = buildLocalProfile({
      rawRut: '123456785',
      firstLaunchAt: '2025-01-15T12:00:00.000Z',
      transactionCount: 57,
      locale: 'es',
    });
    expect(result).toEqual({ rut: '12.345.678-5', since: 'enero 2025', transactionCount: 57 });
  });

  it('falls back to the raw string when formatRut throws', () => {
    const result = buildLocalProfile({
      rawRut: 'garbage',
      firstLaunchAt: '2025-01-15T12:00:00.000Z',
      transactionCount: 0,
      locale: 'es',
    });
    expect(result.rut).toBe('garbage');
  });

  it('renders rut: null when there is no credential entry (Assumption A5)', () => {
    const result = buildLocalProfile({
      rawRut: null,
      firstLaunchAt: '2025-01-15T12:00:00.000Z',
      transactionCount: 0,
      locale: 'es',
    });
    expect(result.rut).toBeNull();
  });

  it('since is undefined when first_launch_at is undefined', () => {
    const result = buildLocalProfile({ rawRut: null, firstLaunchAt: undefined, transactionCount: 0, locale: 'es' });
    expect(result.since).toBeUndefined();
  });

  it('honours the en locale', () => {
    const result = buildLocalProfile({
      rawRut: null,
      firstLaunchAt: '2025-01-15T12:00:00.000Z',
      transactionCount: 0,
      locale: 'en',
    });
    expect(result.since).toBe('January 2025');
  });

  it('transactionCount passes through unchanged, including excluded movements (Decision 16)', () => {
    const result = buildLocalProfile({ rawRut: null, firstLaunchAt: undefined, transactionCount: 42, locale: 'es' });
    expect(result.transactionCount).toBe(42);
  });
});

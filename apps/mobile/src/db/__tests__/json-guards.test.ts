import {
  mergeAssets,
  mergeCategoryLabels,
  mergeInstitutionMetadata,
  mergeProductMetadata,
  mergeTransactionMetadata,
  parseAssets,
  parseCategoryLabels,
  parseInstitutionMetadata,
  parseProductMetadata,
  parseSettingValue,
  parseTransactionMetadata,
  serializeSettingValue,
} from '../json';

/** Scenario 4 (JSON money half), per the Testing Strategy's test-file table. */
describe('json guards — money (AC4)', () => {
  it('parseProductMetadata rejects a fractional balance', () => {
    expect(() => parseProductMetadata(JSON.stringify({ balance: 1842300.5 }))).toThrow(/whole number/);
  });

  it('parseProductMetadata rejects a fractional credit_limit or available_credit', () => {
    expect(() => parseProductMetadata(JSON.stringify({ credit_limit: 500000.25 }))).toThrow();
    expect(() => parseProductMetadata(JSON.stringify({ available_credit: 100.1 }))).toThrow();
  });

  it('parseProductMetadata accepts a whole-number balance, including negative (overdraft)', () => {
    expect(parseProductMetadata(JSON.stringify({ balance: -50000 })).balance).toBe(-50000);
    expect(parseProductMetadata(JSON.stringify({ balance: 1000000 })).balance).toBe(1000000);
  });

  it('mergeProductMetadata rejects a fractional value in the patch before it is ever written', () => {
    expect(() => mergeProductMetadata(null, { balance: 10.5 })).toThrow();
  });
});

describe('json guards — malformed input and unrecognised-key preservation', () => {
  it('every guard returns a safe empty value on malformed JSON rather than throwing', () => {
    expect(parseAssets('not json')).toEqual({});
    expect(parseInstitutionMetadata('not json')).toEqual({});
    expect(parseProductMetadata('not json')).toEqual({});
    expect(parseTransactionMetadata('not json')).toEqual({});
    expect(parseCategoryLabels('not json')).toEqual({});
  });

  it('every guard tolerates null/undefined input', () => {
    expect(parseAssets(null)).toEqual({});
    expect(parseAssets(undefined)).toEqual({});
    expect(parseSettingValue(null)).toBeNull();
  });

  it('merge* preserves an unrecognised key written by another app version', () => {
    const existing = JSON.stringify({ logo: 'asset://banks/bch.png', future_field: 'kept' });
    const merged = mergeAssets(existing, { logo: 'asset://banks/bch-v2.png' });
    const parsed = JSON.parse(merged) as Record<string, unknown>;
    expect(parsed.logo).toBe('asset://banks/bch-v2.png');
    expect(parsed.future_field).toBe('kept');
  });

  it('mergeInstitutionMetadata preserves unrecognised keys', () => {
    const existing = JSON.stringify({ short_name: 'BCH', from_future_version: 42 });
    const merged = mergeInstitutionMetadata(existing, { short_name: 'BancoChile' });
    const parsed = JSON.parse(merged) as Record<string, unknown>;
    expect(parsed.short_name).toBe('BancoChile');
    expect(parsed.from_future_version).toBe(42);
  });

  it('mergeTransactionMetadata preserves unrecognised keys', () => {
    const existing = JSON.stringify({ bank_ref: 'abc', unknown_future_key: true });
    const merged = mergeTransactionMetadata(existing, { bank_ref: 'xyz' });
    const parsed = JSON.parse(merged) as Record<string, unknown>;
    expect(parsed.bank_ref).toBe('xyz');
    expect(parsed.unknown_future_key).toBe(true);
  });

  it('mergeCategoryLabels preserves the unedited locale', () => {
    const existing = JSON.stringify({ es: 'Comida', en: 'Food' });
    const merged = mergeCategoryLabels(existing, { en: 'Food (corrected)' });
    expect(JSON.parse(merged)).toEqual({ es: 'Comida', en: 'Food (corrected)' });
  });

  it('every field is treated as optional — a row with fewer keys than this build still parses', () => {
    expect(parseProductMetadata(JSON.stringify({}))).toEqual({});
    expect(parseCategoryLabels(JSON.stringify({ es: 'Solo español' }))).toEqual({ es: 'Solo español' });
  });

  it('parseSettingValue round-trips through serializeSettingValue for every JSON-representable shape', () => {
    for (const value of [1, 'a', true, null, { a: 1 }, [1, 2, 3]]) {
      expect(parseSettingValue(serializeSettingValue(value))).toEqual(value);
    }
  });
});

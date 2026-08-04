import { resolveSyncErrorKey } from '../sync-error-copy';

/** Implementation plan (issue #20) Testing Strategy, Scenario 14; Decision 10; BR1. */
describe('resolveSyncErrorKey', () => {
  it.each([
    ['invalid_credentials', 'sync.errors.invalid_credentials'],
    ['session_closed', 'sync.errors.session_closed'],
    ['network', 'sync.errors.network'],
    ['parse_failed', 'sync.errors.parse_failed'],
  ] as const)('lastErrorCode=%s -> %s', (code, expectedKey) => {
    expect(resolveSyncErrorKey({ lastErrorCode: code, lastErrorMessage: `sync.errors.${code}` })).toEqual({
      key: expectedKey,
      values: {},
    });
  });

  it('an unrecognised code falls back to sync.errors.unknown', () => {
    expect(
      resolveSyncErrorKey({
        lastErrorCode: 'something_new' as never,
        lastErrorMessage: null,
      }),
    ).toEqual({ key: 'sync.errors.unknown', values: {} });
  });

  it('a null code falls back to sync.errors.unknown', () => {
    expect(resolveSyncErrorKey({ lastErrorCode: null, lastErrorMessage: null })).toEqual({
      key: 'sync.errors.unknown',
      values: {},
    });
  });

  it('never reflects lastErrorMessage content into the resolved key, even when it carries planted bank text (BR1)', () => {
    const plantedText = 'INTERNAL: dump of raw bank response — user password abc123';
    const result = resolveSyncErrorKey({ lastErrorCode: 'network', lastErrorMessage: plantedText });
    expect(result).toEqual({ key: 'sync.errors.network', values: {} });
    expect(JSON.stringify(result)).not.toContain('abc123');
    expect(JSON.stringify(result)).not.toContain(plantedText);
  });
});

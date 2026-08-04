import en from '../../../i18n/en.json';
import es from '../../../i18n/es.json';
import { FAILURE_BODY_KEY, resolveRetryAction, type SyncFailureKind } from '../failure-copy';

const ALL_KINDS: SyncFailureKind[] = [
  'invalid_credentials',
  'session_closed',
  'network',
  'parse_failed',
  'read_in_progress',
];

/** Testing Strategy scenarios 6-7 (implementation plan, issue #11). */
describe('FAILURE_BODY_KEY (scenario 6; brief AC2; Decision 7)', () => {
  it('is total over the four FailureReasonCode values plus read_in_progress', () => {
    expect(Object.keys(FAILURE_BODY_KEY).sort()).toEqual([...ALL_KINDS].sort());
  });

  it.each(ALL_KINDS)('%s resolves to a non-empty, non-key string in es', (kind) => {
    const key = FAILURE_BODY_KEY[kind];
    const value = (es as Record<string, string>)[key] ?? '';
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toBe(key); // the i18next "miss" signature is the raw key echoed back
  });

  it.each(ALL_KINDS)('%s resolves to a non-empty, non-key string in en', (kind) => {
    const key = FAILURE_BODY_KEY[kind];
    const value = (en as Record<string, string>)[key] ?? '';
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toBe(key);
  });

  it('session_closed is the mockup\'s exact sentence in es (Assumption A4)', () => {
    expect((es as Record<string, string>)['bank_syncing.error.body.session_closed']).toBe(
      'El banco cerró la sesión antes de terminar. Tus credenciales siguen guardadas en el dispositivo.',
    );
  });
});

describe('resolveRetryAction (scenario 7; brief AC3; Decision 8)', () => {
  it('returns reenter_credentials for invalid_credentials', () => {
    expect(resolveRetryAction('invalid_credentials')).toBe('reenter_credentials');
  });

  it.each(['session_closed', 'network', 'parse_failed', 'read_in_progress'] as SyncFailureKind[])(
    'returns restart_read for %s',
    (kind) => {
      expect(resolveRetryAction(kind)).toBe('restart_read');
    },
  );
});

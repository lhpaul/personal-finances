import { CredentialHolder } from './credential-holder';
import { FORBIDDEN_TRACE_KEYS, TraceRedactor } from './redaction';
import type { ScraperTrace } from '../types/scrape-result.types';

describe('TraceRedactor', () => {
  it('redacts a credential value appearing anywhere in a trace message', () => {
    const credentials = new CredentialHolder({ rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' });
    const redactor = new TraceRedactor(credentials);
    const trace: ScraperTrace = {
      logGroup: 'login',
      type: 'info',
      message: 'filled rut input with ZZSENTINELRUTZZ',
      timestamp: 0,
    };
    const redacted = redactor.redactTrace(trace);
    expect(redacted.message).not.toContain('ZZSENTINELRUTZZ');
    expect(redacted.message).toContain('[REDACTED]');
  });

  it('redacts a credential value nested inside trace.data', () => {
    const credentials = new CredentialHolder({ rut: 'r', password: 'ZZSENTINELPASSZZ' });
    const redactor = new TraceRedactor(credentials);
    const trace: ScraperTrace = {
      logGroup: 'login',
      type: 'error',
      message: 'step failed',
      timestamp: 0,
      data: { nested: { detail: 'password was ZZSENTINELPASSZZ' } },
    };
    const redacted = redactor.redactTrace(trace);
    expect(JSON.stringify(redacted)).not.toContain('ZZSENTINELPASSZZ');
  });

  it('strips every forbidden key regardless of clear state', () => {
    const credentials = new CredentialHolder({ rut: 'r', password: 'p' });
    credentials.clear();
    const redactor = new TraceRedactor(credentials);
    for (const key of FORBIDDEN_TRACE_KEYS) {
      const payload = { [key]: 'some sensitive text', safe: 'kept' };
      const redacted = redactor.redactErrorPayload(payload);
      expect((redacted as Record<string, unknown>)[key]).toBe('[REDACTED_KEY]');
      expect((redacted as Record<string, unknown>).safe).toBe('kept');
    }
  });

  it('after clear(), value-scanning is a no-op but key-based redaction still applies', () => {
    const credentials = new CredentialHolder({ rut: 'ZZSENTINELRUTZZ', password: 'p' });
    const redactor = new TraceRedactor(credentials);
    credentials.clear();
    const trace: ScraperTrace = {
      logGroup: 'login',
      type: 'info',
      message: 'no read is in flight; a stray ZZSENTINELRUTZZ here is not the credential path',
      timestamp: 0,
    };
    // This documents the safe-by-construction reason value scanning is skipped post-clear: no
    // credential-bearing message can be produced once no read is in flight (the coincidental
    // string above is not the credential path this class defends).
    const redacted = redactor.redactTrace(trace);
    expect(redacted.message).toContain('ZZSENTINELRUTZZ');
  });

  it('does not over-fire: a message with no credential content and no forbidden key survives untouched', () => {
    const credentials = new CredentialHolder({ rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' });
    const redactor = new TraceRedactor(credentials);
    const trace: ScraperTrace = {
      logGroup: 'submit-form',
      type: 'info',
      message: 'Step completed',
      timestamp: 123,
      data: { attempts: 1, productCount: 3 },
    };
    const redacted = redactor.redactTrace(trace);
    expect(redacted).toEqual(trace);
  });

  it('does not redact an empty-string credential field (it would match everything)', () => {
    const credentials = new CredentialHolder({ rut: '', password: 'p' });
    const redactor = new TraceRedactor(credentials);
    const trace: ScraperTrace = { logGroup: 'g', type: 'info', message: 'unrelated text', timestamp: 0 };
    expect(redactor.redactTrace(trace).message).toBe('unrelated text');
  });
});

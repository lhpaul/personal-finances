import { CredentialHolder } from '../security/credential-holder';
import { TraceRedactor } from '../security/redaction';
import { MessageHandlerService } from './message-handler.service';

function buildService(): { service: MessageHandlerService; credentials: CredentialHolder } {
  const credentials = new CredentialHolder({ rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' });
  const redactor = new TraceRedactor(credentials);
  return { service: new MessageHandlerService(redactor), credentials };
}

describe('MessageHandlerService', () => {
  it('routes a trace event and redacts credential content in it', () => {
    const { service } = buildService();
    const traces: unknown[] = [];
    service.handleMessage(
      JSON.stringify({
        eventType: 'trace',
        data: { logGroup: 'login', type: 'info', message: 'filled ZZSENTINELRUTZZ', timestamp: 1 },
      }),
      { onTrace: (t) => traces.push(t), onError: () => {}, onStateChange: () => {} },
    );
    expect(traces).toHaveLength(1);
    expect(JSON.stringify(traces[0])).not.toContain('ZZSENTINELRUTZZ');
  });

  it('routes a bare string trace payload', () => {
    const { service } = buildService();
    const traces: unknown[] = [];
    service.handleMessage(JSON.stringify({ eventType: 'trace', data: 'plain string trace' }), {
      onTrace: (t) => traces.push(t),
      onError: () => {},
      onStateChange: () => {},
    });
    expect(traces).toEqual([{ logGroup: undefined, type: 'info', message: 'plain string trace', timestamp: expect.any(Number) }]);
  });

  it('routes an error event and redacts it', () => {
    const { service } = buildService();
    const errors: unknown[] = [];
    service.handleMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'invalid_credentials', detail: 'ZZSENTINELPASSZZ' } }),
      { onTrace: () => {}, onError: (e) => errors.push(e), onStateChange: () => {} },
    );
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0])).not.toContain('ZZSENTINELPASSZZ');
  });

  it('routes a state-change event with its stepId, progress and data', () => {
    const { service } = buildService();
    const states: unknown[] = [];
    service.handleMessage(
      JSON.stringify({ eventType: 'state-change', stepId: 'get-products-start', progress: 0.5, data: { products: [] } }),
      { onTrace: () => {}, onError: () => {}, onStateChange: (s) => states.push(s) },
    );
    expect(states).toEqual([{ stepId: 'get-products-start', progress: 0.5, data: { products: [] } }]);
  });

  it('traces (does not throw) on malformed JSON', () => {
    const { service } = buildService();
    const traces: unknown[] = [];
    expect(() =>
      service.handleMessage('{not valid json', { onTrace: (t) => traces.push(t), onError: () => {}, onStateChange: () => {} }),
    ).not.toThrow();
    expect(traces).toHaveLength(1);
  });

  it('traces (does not throw) on an unrecognized eventType', () => {
    const { service } = buildService();
    const traces: unknown[] = [];
    service.handleMessage(JSON.stringify({ eventType: 'made-up-type' }), {
      onTrace: (t) => traces.push(t),
      onError: () => {},
      onStateChange: () => {},
    });
    expect(traces).toHaveLength(1);
  });

  it('does not over-fire: a message with no credential content passes through untouched', () => {
    const { service } = buildService();
    const traces: unknown[] = [];
    service.handleMessage(
      JSON.stringify({ eventType: 'trace', data: { logGroup: 'submit-form', type: 'info', message: 'Step completed', timestamp: 123 } }),
      { onTrace: (t) => traces.push(t), onError: () => {}, onStateChange: () => {} },
    );
    expect(traces).toEqual([{ logGroup: 'submit-form', type: 'info', message: 'Step completed', timestamp: 123 }]);
  });
});

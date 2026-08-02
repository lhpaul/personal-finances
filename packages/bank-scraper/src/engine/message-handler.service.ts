import { ScraperEventType, type ScraperStepId } from '../types/protocol.types';
import type { ScraperTrace } from '../types/scrape-result.types';
import type { TraceRedactor } from '../security/redaction';

/**
 * Inbound message routing, redaction, and the finalized-guard (spec Business Rules 3-4;
 * implementation plan Layer-by-Layer Changes → engine; Concurrency Safety Checklist).
 * `handleMessage` is synchronous end to end — it parses, redacts, routes and returns, with no
 * `await` — so it cannot interleave with itself even though multiple `onMessage` events can fire
 * in quick succession.
 */

export interface StateChangePayload {
  stepId: ScraperStepId;
  progress: number;
  data?: { products?: unknown[]; movements?: unknown[] };
}

export interface MessageHandlerCallbacks {
  onTrace(trace: ScraperTrace): void;
  onError(payload: unknown): void;
  onStateChange(payload: StateChangePayload): void;
}

export class MessageHandlerService {
  readonly #redactor: TraceRedactor;

  constructor(redactor: TraceRedactor) {
    this.#redactor = redactor;
  }

  handleMessage(rawData: string, callbacks: MessageHandlerCallbacks): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      callbacks.onTrace(
        this.#redactor.redactTrace({
          logGroup: 'message-handler',
          type: 'error',
          message: 'Failed to parse inbound message',
          timestamp: Date.now(),
        }),
      );
      return;
    }

    const message = parsed as { eventType?: string; data?: unknown; stepId?: string; progress?: number };
    switch (message.eventType) {
      case ScraperEventType.ERROR:
        callbacks.onError(this.#redactor.redactErrorPayload(message.data));
        return;
      case ScraperEventType.TRACE:
        callbacks.onTrace(this.#redactor.redactTrace(this.#toTrace(message.data)));
        return;
      case ScraperEventType.STATE_CHANGE:
        callbacks.onStateChange(
          this.#redactor.redactErrorPayload({
            stepId: message.stepId,
            progress: message.progress,
            data: message.data,
          }) as StateChangePayload,
        );
        return;
      default:
        callbacks.onTrace({
          logGroup: 'message-handler',
          type: 'warning',
          message: 'Unknown message type',
          timestamp: Date.now(),
          data: { eventType: message.eventType },
        });
    }
  }

  #toTrace(data: unknown): ScraperTrace {
    if (typeof data === 'string') {
      return { logGroup: undefined, type: 'info', message: data, timestamp: Date.now() };
    }
    const record = (data ?? {}) as Partial<ScraperTrace>;
    return {
      logGroup: record.logGroup,
      type: record.type ?? 'info',
      message: record.message ?? '',
      timestamp: record.timestamp ?? Date.now(),
      ...(record.data !== undefined ? { data: record.data } : {}),
    };
  }
}

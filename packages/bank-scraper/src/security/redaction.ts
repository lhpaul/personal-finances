import type { ScraperTrace } from '../types/scrape-result.types';
import type { CredentialHolder } from './credential-holder';

/**
 * Key-based redaction (spec Business Rules 3-4; implementation plan Decision 5, control 2).
 * Any of these keys is dropped from a trace or error payload before it becomes text, regardless
 * of whether a read is in flight — this is what makes `ScraperTrace` incapable of carrying the
 * generated script source even if one arrives from the page after `clear()`.
 */
export const FORBIDDEN_TRACE_KEYS: readonly string[] = [
  'scriptSource',
  'script',
  'password',
  'rut',
  'credential',
  'credentials',
  'credentialValue',
  'rawCredentials',
  'value',
];

const REDACTED_KEY_MARKER = '[REDACTED_KEY]';
const REDACTED_VALUE_MARKER = '[REDACTED]';

function stripForbiddenKeys<T>(value: T): T {
  return walk(value, (key, v) => {
    if (key !== undefined && FORBIDDEN_TRACE_KEYS.includes(key)) {
      return REDACTED_KEY_MARKER;
    }
    return v;
  });
}

function replaceNeedles<T>(value: T, needles: readonly string[]): T {
  if (needles.length === 0) return value;
  return walk(value, (_key, v) => {
    if (typeof v !== 'string') return v;
    let result = v;
    for (const needle of needles) {
      if (needle.length === 0) continue;
      result = result.split(needle).join(REDACTED_VALUE_MARKER);
    }
    return result;
  });
}

/** Recursively rebuilds `value`, applying `transform` to every leaf (string/primitive) node. */
function walk<T>(value: T, transform: (key: string | undefined, v: unknown) => unknown, key?: string): T {
  const transformed = transform(key, value);
  if (transformed !== value) {
    // A key- or value-level substitution already happened for this node; do not recurse into it
    // (a redacted marker string has nothing left to scan).
    return transformed as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, transform)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = walk(v, transform, k);
    }
    return result as unknown as T;
  }
  return value;
}

/**
 * Scans every outbound trace and error payload for the current credential values before it
 * becomes text (Decision 5, control 4). Holds a reference to the **same** `CredentialHolder`
 * passed to `ScrapeSession` — not a second copy — so one `clear()` disarms both the holder and
 * this redactor's scanning input simultaneously. After `clear()`, value-scanning is a no-op and
 * only key-based redaction (always active) remains.
 */
export class TraceRedactor {
  readonly #credentials: CredentialHolder;

  constructor(credentials: CredentialHolder) {
    this.#credentials = credentials;
  }

  redactTrace(trace: ScraperTrace): ScraperTrace {
    return this.#redact(trace);
  }

  redactErrorPayload<T>(payload: T): T {
    return this.#redact(payload);
  }

  #redact<T>(value: T): T {
    const keysStripped = stripForbiddenKeys(value);
    if (this.#credentials.isCleared()) {
      return keysStripped;
    }
    return this.#credentials.consume((fields) => {
      const needles = Object.values(fields).filter((v) => v.length > 0);
      return replaceNeedles(keysStripped, needles);
    });
  }
}

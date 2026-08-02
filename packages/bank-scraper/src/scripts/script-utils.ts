import { PRODUCT_ID_DOMAIN_SEPARATOR, MAX_STEP_ATTEMPTS, MAX_ELEMENT_ATTEMPTS, STEP_RETRY_DELAY_MS, ELEMENT_RETRY_DELAY_MS } from '../engine/constants';
import { ScraperEventType } from '../types/protocol.types';

/**
 * Bank-agnostic building blocks for an injected page script (implementation plan Layer-by-Layer
 * Changes → injected-script helpers; Decision 1). Everything here runs **inside the page** and is
 * therefore a generated JavaScript **string**, not executed TypeScript — no unit test can run this
 * code directly, only assert what string it produces (see `no-float-parsing.test.ts` and
 * `no-network-egress.test.ts`, which scan the generated source text).
 *
 * Ported from the proven source implementation with one structural change (Decision 1): this
 * version posts **raw strings and structural facts** only. `formatDate` / `parseIntAmount` /
 * `parseFloatAmount` are **not** ported — they lived here in the source and are exactly where its
 * two worst defects lived (a `float` from `parseFloatAmount`, and a device-local-zone `Date` from
 * `formatDate`). Amount and date parsing now happens on the React Native side
 * (`src/parsing/amount.ts`, `src/parsing/date.ts`).
 */

/** `sendTrace`, `wait`, and `waitForPageToBeReady` — no amount or date parsing (Decision 1). */
export function commonHelperFunctions(): string {
  return `
    function sendTrace(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: '${ScraperEventType.TRACE}',
        data: data,
      }));
    }
    async function wait(milliseconds) {
      return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      });
    }
    async function waitForPageToBeReady(logGroup) {
      let retries = 0;
      while (document.readyState !== 'complete') {
        if (retries > ${MAX_ELEMENT_ATTEMPTS}) {
          throw new Error('Page not ready after ${MAX_ELEMENT_ATTEMPTS} retries');
        }
        sendTrace({ logGroup, type: 'warning', message: 'Page not ready, retrying... ' + retries + ' times' });
        retries++;
        await wait(${ELEMENT_RETRY_DELAY_MS});
      }
      return true;
    }
  `;
}

/**
 * Wraps `code` in a bounded-retry loop (spec Business Rule 21, AC19; Decision 8). On success,
 * posts a `TRACE` carrying `attempts` (so a first-try success records `attempts: 1`). On
 * exhaustion, posts an `ERROR` with `code: 'parse_failed'` (a step-level failure — the specific
 * `invalid_credentials` / `session_closed` / `network` reasons are posted by dedicated,
 * non-retried code paths elsewhere, never by this generic wrapper) and `attempts` equal to the
 * configured maximum. `productInstanceId` is included automatically when a page-global `productId`
 * variable is in scope (set by the home script before navigating to a product's own page) — this
 * is what lets the very same wrapper serve both a read-level script (login, home) and a
 * product-scoped one (account-transactions, credit-card-details) without the wrapper itself
 * knowing which.
 *
 * If `stepName` is `null`, the wrapper assumes the variable `stepName` already exists in scope
 * (used by the account-transactions script's `for` loop, which sets `stepName` itself per
 * iteration).
 */
export function generateExecutableStepFunction(
  input: { stepName: string | null; logGroup: string; code: string },
  options?: { maxRetries?: number; retryDelay?: number },
): string {
  const { stepName, logGroup, code } = input;
  const { maxRetries = MAX_STEP_ATTEMPTS, retryDelay = STEP_RETRY_DELAY_MS } = options ?? {};
  return `
    await (async function() {
      const maxRetries = ${maxRetries};
      const retryDelay = ${retryDelay};
      ${stepName ? `const stepName = '${stepName}';` : ''}
      const logGroup = '${logGroup}';
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await (async function() {
            ${code}
          })();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            eventType: '${ScraperEventType.TRACE}',
            data: {
              logGroup,
              type: 'info',
              message: 'Step completed',
              data: { stepName, attempts: attempt },
            },
          }));
          return { result, attempt };
        } catch (error) {
          lastError = error;
          sendTrace({
            logGroup,
            type: 'warning',
            message: 'Step failed: ' + stepName + ' (attempt ' + attempt + '/' + maxRetries + ') - ' + error.message,
          });
          if (attempt < maxRetries) {
            await wait(retryDelay);
          }
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: '${ScraperEventType.ERROR}',
        data: {
          code: 'parse_failed',
          step: stepName,
          attempts: maxRetries,
          productInstanceId: (typeof productId !== 'undefined' ? productId : undefined),
        }
      }));
      throw lastError;
    })()
  `;
}

/** Waits for `selector` to resolve to a truthy element, retrying up to `maxRetries` times. */
export function generateWaitForElementHelperFunctions(
  input: { label: string; selector: string },
  options?: { maxRetries?: number; retryDelay?: number },
): string {
  const { label, selector } = input;
  const { maxRetries = MAX_ELEMENT_ATTEMPTS, retryDelay = ELEMENT_RETRY_DELAY_MS } = options ?? {};
  return `
    async function waitFor${label}Element() {
      let element = ${selector};
      let retries = 0;
      while (!element) {
        if (retries > ${maxRetries}) {
          throw new Error('Element not found after ${maxRetries} retries');
        }
        retries++;
        await wait(${retryDelay});
        element = ${selector};
      }
      return element;
    }
  `;
}

/**
 * Posts `invalid_credentials` directly, bypassing the retry wrapper entirely (spec Business Rule
 * 22, AC14; Decision 8: `invalid_credentials` is never retried, at all). No `message` field is
 * included — the bank's own error text is never attached to the failure (Decision 5, control 3):
 * the echo channel is removed rather than filtered.
 */
export function generateLoginInvalidCredentialsErrorFunction(): string {
  return `
    function sendLoginInvalidCredentialsError() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: '${ScraperEventType.ERROR}',
        data: {
          code: 'invalid_credentials',
          step: 'check-for-login-errors',
        }
      }));
    }
  `;
}

/**
 * Computes the opaque product instance identity **inside the page** (spec Business Rule 15,
 * Conflict 1, AC24; Decision 6): `sha256hex('finanzas.product.v1|<bankId>|<kindKey>|<rawIdentifier>')`,
 * truncated to 32 hex characters. Hashing here — rather than on the React Native side — is what
 * keeps the raw account/card number from ever crossing the bridge (Decision 6, spec Decision 10).
 * If `crypto.subtle` is unavailable, this throws rather than falling back to the raw identifier or
 * an index; the caller must treat that as a `parse_failed` for that product only.
 */
export function generateInstanceIdHelperFunction(): string {
  return `
    async function computeInstanceId(bankId, kindKey, rawIdentifier) {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('crypto.subtle unavailable — cannot derive an opaque product identity');
      }
      const input = '${PRODUCT_ID_DOMAIN_SEPARATOR}' + '|' + bankId + '|' + kindKey + '|' + rawIdentifier;
      const encoder = new TextEncoder();
      const digestBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(input));
      const hexFull = Array.from(new Uint8Array(digestBuffer))
        .map(function (byteValue) { return byteValue.toString(16).padStart(2, '0'); })
        .join('');
      return hexFull.slice(0, 32);
    }
  `;
}

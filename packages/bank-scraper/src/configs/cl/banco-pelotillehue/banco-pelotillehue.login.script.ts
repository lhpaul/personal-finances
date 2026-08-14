import { generateLoginInvalidCredentialsErrorFunction } from '../../../scripts/script-utils';
import { toJsStringLiteral } from '../../../security/js-string-literal';
import {
  PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN,
  PELOTILLEHUE_INVALID_RUT,
} from './banco-pelotillehue.constants';

const CHECKING_INSTANCE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CARD_INSTANCE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

/**
 * Synthetic login routine. Credential values are inspected on the React Native side and never
 * interpolated into the generated string — a rejected sentinel RUT and a successful read produce
 * two different scripts, neither of which contains the RUT or password.
 */
export function loginScript(credentials: { rut: string; password: string }): string {
  const missing = credentials.rut.length === 0 || credentials.password.length === 0;
  const rejected = missing || credentials.rut === PELOTILLEHUE_INVALID_RUT;
  return rejected ? rejectedLoginScript() : successfulLoginScript();
}

function originPreamble(): string {
  return `
    if (window.location.origin !== ${toJsStringLiteral(PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN)}) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'error',
        data: { code: 'network' },
      }));
      return;
    }
  `;
}

function rejectedLoginScript(): string {
  return `
    (function () {
      ${originPreamble()}
      ${generateLoginInvalidCredentialsErrorFunction()}
      sendLoginInvalidCredentialsError();
    })();
  `;
}

function successfulLoginScript(): string {
  return `
    (function () {
      ${originPreamble()}

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.3,
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.5,
        data: {
          products: [
            {
              instanceId: '${CHECKING_INSTANCE_ID}',
              kindKey: 'cuenta-corriente',
              displayName: 'Cuenta Corriente',
              currencyCode: 'CLP',
              maskedIdentifier: '••••5678',
              balanceText: '$125.000',
            },
            {
              instanceId: '${CARD_INSTANCE_ID}',
              kindKey: 'tarjeta-credito',
              displayName: 'Tarjeta Visa',
              currencyCode: 'CLP',
              maskedIdentifier: '••••1234',
              cardLast4: '1234',
              creditLimitText: '$3.000.000',
            },
          ],
        },
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.8,
        data: {
          transactions: [
            {
              productInstanceId: '${CHECKING_INSTANCE_ID}',
              dateText: '01/03/2026',
              outgoingText: '$45.000',
              incomingText: null,
              currencyCode: 'CLP',
              rawDescription: 'SUPERMERCADO',
              bankSuppliedId: null,
              positionInReadSnapshot: 0,
              extras: {},
            },
            {
              productInstanceId: '${CHECKING_INSTANCE_ID}',
              dateText: '02/03/2026',
              outgoingText: null,
              incomingText: '$150.000',
              currencyCode: 'CLP',
              rawDescription: 'TRANSFERENCIA RECIBIDA',
              bankSuppliedId: null,
              positionInReadSnapshot: 1,
              extras: {},
            },
            {
              productInstanceId: '${CARD_INSTANCE_ID}',
              dateText: '03/03/2026',
              outgoingText: '$15.000',
              incomingText: null,
              currencyCode: 'CLP',
              rawDescription: 'COMPRA EN LINEA',
              bankSuppliedId: null,
              positionInReadSnapshot: 0,
              extras: { billed: 'true' },
            },
          ],
        },
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'ready',
        progress: 1,
      }));
    })();
  `;
}

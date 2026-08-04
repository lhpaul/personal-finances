import type { BankConnectionSummary, BankProductSummary } from '../../db/types';

/**
 * The frozen, `__DEV__`-only presentations for the five fidelity-preview states (implementation
 * plan for issue #20, Decision 13). Connections and products are **never seeded** (item #10), so
 * a fidelity capture — which reads `seed-default` — has no real connection to render; each route
 * renders one of these fixed presentations instead, under `useFidelityPreview()`, performing no
 * read at all. Carries the mockup's own sample values (Banco de Chile, three products, `••4821`,
 * `••7734`, cupo `$2.500.000`) so a capture matches the mockup pixel-for-pixel; contains no
 * credential and no real data.
 */

/** A fixed instant so every relative-time descriptor a capture renders is reproducible. */
export const FIDELITY_PREVIEW_NOW = new Date('2026-02-10T12:00:00.000Z');

const HEALTHY_CONNECTION: BankConnectionSummary = {
  id: 'fidelity-preview-connection',
  institutionId: 'banco-de-chile',
  name: 'Banco de Chile',
  shortName: 'BCH',
  brandColor: '#003da5', // style-literal-allow: fixture data (financial_institutions seed value), not a style prop
  logoUrl: undefined,
  status: 'active',
  syncStatus: 'ok',
  lastSyncAt: '2026-02-10T10:00:00.000Z', // "hace 2 h", matching the mockup's own sample
  lastSuccessAt: '2026-02-10T10:00:00.000Z',
  lastErrorCode: null,
  lastErrorMessage: null,
  productCount: 3,
};

const ERROR_CONNECTION: BankConnectionSummary = {
  ...HEALTHY_CONNECTION,
  syncStatus: 'error',
  lastSuccessAt: '2026-02-09T21:14:00.000Z', // "ayer 21:14", the mockup's own sample
  lastErrorCode: 'invalid_credentials',
  lastErrorMessage: 'sync.errors.invalid_credentials',
};

const PREVIEW_PRODUCTS: BankProductSummary[] = [
  {
    id: 'fidelity-preview-product-checking',
    externalId: 'fidelity-preview-product-checking',
    type: 'checking',
    name: 'Cuenta corriente',
    currencyCode: 'CLP',
    mask: '4821',
    balanceMinorUnits: 1_842_300,
    creditLimitMinorUnits: undefined,
    availableCreditMinorUnits: undefined,
  },
  {
    id: 'fidelity-preview-product-credit-card',
    externalId: 'fidelity-preview-product-credit-card',
    type: 'credit_card',
    name: 'Tarjeta de crédito',
    currencyCode: 'CLP',
    mask: '7734',
    balanceMinorUnits: 412_000,
    creditLimitMinorUnits: 2_500_000,
    availableCreditMinorUnits: 2_088_000,
  },
  {
    id: 'fidelity-preview-product-credit-line',
    externalId: 'fidelity-preview-product-credit-line',
    type: 'credit_line',
    name: 'Línea de crédito',
    currencyCode: 'CLP',
    mask: '4821',
    balanceMinorUnits: 0,
    creditLimitMinorUnits: 800_000,
    availableCreditMinorUnits: 800_000,
  },
];

/** `settings-banks`'s preview connections list. `'empty'` renders none; `'list'` and
 * `'disconnect-confirm'` both render the one healthy connection — the confirmation modal for
 * `'disconnect-confirm'` is opened by the preview state itself, not by Decision 7's `disconnect`
 * route param (which a fidelity deep link never carries). */
export function fidelityBankConnections(previewState: string | null): BankConnectionSummary[] {
  return previewState === 'empty' ? [] : [HEALTHY_CONNECTION];
}

/** `bank-review`'s preview connection + products. `'error'` renders the errored connection with
 * the mockup's own `invalid_credentials` sample; every other state renders the healthy one. */
export function fidelityBankReview(previewState: string | null): {
  connection: BankConnectionSummary;
  products: BankProductSummary[];
} {
  return {
    connection: previewState === 'error' ? ERROR_CONNECTION : HEALTHY_CONNECTION,
    products: PREVIEW_PRODUCTS,
  };
}

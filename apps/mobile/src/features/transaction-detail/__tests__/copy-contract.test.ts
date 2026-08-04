/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 17 (AGENTS.md
 * non-negotiable 8). Scans the route file, the screen and its `components/` folder with the
 * shipped `catalogue-key-scan.ts` helper — the same control #13's own `copy-contract.test.ts`
 * applies — and checks every found key both exists in `es.json` and matches the plan's Copy
 * contract mapping table character for character.
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import { findTranslationKeys } from '../../../test-utils/catalogue-key-scan';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', 'transactions');
const FEATURE_ROOT = path.resolve(__dirname, '..');

const SCANNED_FILES = [
  path.join(APP_ROOT, '[transactionId].tsx'),
  path.join(FEATURE_ROOT, 'TransactionDetailScreen.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DetailTopBar.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DetailHeroCard.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DetailInfoCard.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DetailNoteField.tsx'),
  path.join(FEATURE_ROOT, 'components', 'ExclusionNote.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DetailActions.tsx'),
  path.join(FEATURE_ROOT, 'components', 'CategoryPickerSheet.tsx'),
];

/** Transcribed from the implementation plan's "Copy contract mapping" table. */
const EXPECTED_SPANISH: Record<string, string> = {
  'transaction_detail.topbar_title': 'Detalle de transacción',
  'transaction_detail.back_a11y': 'Volver',
  'transaction_detail.badge_expense': 'Gasto',
  'transaction_detail.badge_income': 'Ingreso',
  'transaction_detail.badge_excluded': 'Excluida del análisis',
  'transaction_detail.icon_uncategorized': '❓',
  'transaction_detail.icon_excluded': '🚫',
  'transaction_detail.info_title': 'Información',
  'transaction_detail.info_merchant': 'Comercio',
  'transaction_detail.info_date': 'Fecha',
  'transaction_detail.info_time': 'Hora',
  'transaction_detail.info_product': 'Producto',
  'transaction_detail.info_category': 'Categoría',
  'transaction_detail.info_missing': '—',
  'transaction_detail.category_value': '{{emoji}} {{name}}',
  'transaction_detail.uncategorized_badge': 'Sin categorizar',
  'transaction_detail.auto_suggested': 'Categoría sugerida automáticamente según el comercio',
  'transaction_detail.product_value': '{{name}} ••{{mask}}',
  'transaction_detail.description_label': 'Descripción del banco',
  'transaction_detail.note_label': 'Nota',
  'transaction_detail.note_placeholder': 'Agregar una nota…',
  'transaction_detail.excluded_note_icon': '🚫',
  'transaction_detail.excluded_note_strong': 'Excluida del análisis.',
  'transaction_detail.excluded_note_body': 'Motivo: {{reason}}. No cuenta en totales ni gráficos.',
  'transaction_detail.reason_personal_transfer': 'transferencia personal',
  'transaction_detail.reason_shared_expense': 'involucra más personas',
  'transaction_detail.reason_not_relevant': 'gasto no relevante',
  'transaction_detail.reason_cash_withdrawal': 'retiro de efectivo',
  'transaction_detail.reason_other': 'otro',
  'transaction_detail.action_categorize': 'Categorizar ahora',
  'transaction_detail.action_change_category': 'Cambiar categoría',
  'transaction_detail.action_merchant': 'Configurar comercio',
  'transaction_detail.action_exclude': 'Excluir del análisis',
  'transaction_detail.action_reinclude': 'Volver a incluir en el análisis',
  'transaction_detail.picker_title': 'Elegir categoría',
  'transaction_detail.picker_cancel': 'Cancelar',
  'transaction_detail.write_failed_icon': '⚠️',
  'transaction_detail.write_failed': 'No pudimos guardar ese cambio. Inténtalo de nuevo.',
  'transaction_detail.not_found': 'No encontramos esta transacción.',
};

function scanAll(): { keys: string[]; dynamic: { file: string; line: number; column: number }[] } {
  const keys: string[] = [];
  const dynamic: { file: string; line: number; column: number }[] = [];

  for (const file of SCANNED_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error(`Scanned transaction-detail file is missing: ${file}. Update SCANNED_FILES.`);
    }
    const source = fs.readFileSync(file, 'utf8');
    const result = findTranslationKeys(source);
    keys.push(...result.keys);
    dynamic.push(...result.dynamic.map((finding) => ({ file: path.basename(file), ...finding })));
  }

  return { keys, dynamic };
}

describe('transaction-detail screen copy contract (Scenario 17)', () => {
  it('every scanned file exists', () => {
    for (const file of SCANNED_FILES) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  const { keys, dynamic } = scanAll();
  const uniqueKeys = Array.from(new Set(keys));

  it('found call sites to check', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('uses no dynamic (non-literal) key anywhere on the transaction-detail screen', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  /**
   * `transaction_detail.product_value` is defined for Copy contract completeness but is not
   * independently rendered via `t()`: `formatProductLabel` (`product-label.ts`) is the actual
   * renderer — a locale-independent pure formatter, the same precedent `formatClp` /
   * `formatLongDate` already set in this codebase for stored-value display strings that are not
   * translated copy. Mirrors #13's own `categorize.suggested_star` exemption.
   */
  const NOT_INDEPENDENTLY_RENDERED = new Set(['transaction_detail.product_value']);

  const transactionDetailCatalogueKeys = Object.keys(es).filter((key) => key.startsWith('transaction_detail.'));

  it.each(transactionDetailCatalogueKeys.filter((key) => !NOT_INDEPENDENTLY_RENDERED.has(key)))(
    'catalogue key %s is used by the screen or a component',
    (key) => {
      expect(uniqueKeys).toContain(key);
    },
  );

  const expectedKeys = Object.keys(EXPECTED_SPANISH);

  it('the expected-value map covers every transaction_detail catalogue key', () => {
    expect(expectedKeys.sort()).toEqual(transactionDetailCatalogueKeys.sort());
  });

  it.each(expectedKeys)('es.json value for %s matches the Copy contract table character for character', (key) => {
    expect((es as Record<string, string>)[key]).toBe(EXPECTED_SPANISH[key]);
  });
});

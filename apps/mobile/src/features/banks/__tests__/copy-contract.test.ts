import es from '../../../i18n/es.json';
import en from '../../../i18n/en.json';

/**
 * Implementation plan (issue #20), Copy inventory. Unlike item #13/#16's `copy-contract.test.ts`
 * (which scans `t('literal.key')` call sites), this feature's keys are resolved dynamically
 * through composed `CopyFragment`s (`translate-fragment.ts`) — every producing function
 * (`connection-view.ts`, `sync-error-copy.ts`, `product-view.ts`) already has its own unit test
 * asserting the exact key + values per branch. This file instead checks the catalogue itself: the
 * explicit key list below (transcribed from the Copy inventory table) is exactly the set of
 * `settings_banks.*` / `bank_review.*` / `sync.errors.*` keys in `es.json` — bidirectionally, so a
 * typo in either direction (a key this feature expects but the catalogue lacks, or a catalogue
 * key this feature no longer produces) fails loudly.
 */
const EXPECTED_KEYS = [
  'settings_banks.title',
  'settings_banks.back_label',
  'settings_banks.summary',
  'settings_banks.row_subtitle',
  'settings_banks.bank_count_one',
  'settings_banks.bank_count_other',
  'settings_banks.product_count_one',
  'settings_banks.product_count_other',
  'settings_banks.synced_minutes',
  'settings_banks.synced_hours',
  'settings_banks.synced_yesterday',
  'settings_banks.synced_date',
  'settings_banks.never_synced',
  'settings_banks.sync_error',
  'settings_banks.status_ok',
  'settings_banks.status_error',
  'settings_banks.badge_ok',
  'settings_banks.badge_error',
  'settings_banks.add_bank',
  'settings_banks.disconnect_named',
  'settings_banks.empty_title',
  'settings_banks.empty_body',
  'settings_banks.empty_cta',
  'settings_banks.disconnect_title',
  'settings_banks.disconnect_body',
  'settings_banks.disconnect_cancel',
  'settings_banks.disconnect_confirm',
  'settings_banks.disconnect_failed',
  'bank_review.back_label',
  'bank_review.badge_ok',
  'bank_review.badge_error',
  'bank_review.synced_minutes',
  'bank_review.synced_hours',
  'bank_review.synced_yesterday',
  'bank_review.synced_date',
  'bank_review.last_success_minutes',
  'bank_review.last_success_hours',
  'bank_review.last_success_yesterday',
  'bank_review.last_success_date',
  'bank_review.never_synced',
  'bank_review.products_title',
  'bank_review.product_meta_mask',
  'bank_review.product_meta_mask_cupo',
  'bank_review.product_meta_cupo',
  'bank_review.auto_sync_note',
  'bank_review.auto_sync_icon',
  'bank_review.update_credentials',
  'bank_review.sync_now',
  'bank_review.disconnect',
  'bank_review.disconnect_icon',
  'bank_review.error_icon',
  'sync.errors.invalid_credentials',
  'sync.errors.session_closed',
  'sync.errors.network',
  'sync.errors.parse_failed',
  'sync.errors.unknown',
].sort();

function bankPrefixedKeys(catalogue: Record<string, string>): string[] {
  return Object.keys(catalogue)
    .filter(
      (key) =>
        key.startsWith('settings_banks.') || key.startsWith('bank_review.') || key.startsWith('sync.errors.'),
    )
    .sort();
}

describe('issue #20 copy contract', () => {
  it('the expected key list matches es.json exactly (bidirectional)', () => {
    expect(bankPrefixedKeys(es)).toEqual(EXPECTED_KEYS);
  });

  it('the expected key list matches en.json exactly (bidirectional)', () => {
    expect(bankPrefixedKeys(en)).toEqual(EXPECTED_KEYS);
  });

  it("sync.errors.invalid_credentials is the mockup's own sentence, verbatim", () => {
    expect(es['sync.errors.invalid_credentials']).toBe(
      'El banco rechazó las credenciales. Puede que hayas cambiado tu clave de internet. Vuelve a ingresarla para reanudar la sincronización.',
    );
  });
});

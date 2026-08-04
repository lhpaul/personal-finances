import fs from 'node:fs';
import path from 'node:path';

import es from '../../../src/i18n/es.json';
import { findTranslationKeys } from '../../../src/test-utils/catalogue-key-scan';

/**
 * Scenario 14 of the implementation plan for issue #21's Testing Strategy: "the four manifest
 * states render, and ✨ Otros is inert." Source-text assertions, in the same spirit as item #19's
 * `routes.test.ts` (whose own doc comment records the reason: these files call hooks
 * (`useFocusEffect`, `useRouter`, `useTranslation`), and `@testing-library/react-native` is not
 * installed in this repository (implementation plan Decision 11) — so a mechanical check over the
 * file, not a render, is this codebase's established substitute. `isOtrosSlug`'s own behaviour
 * (which of the two `settings-categories` categories it is inert *for*) is unit-tested directly
 * in `src/db/__tests__/categories.test.ts`; this file checks that the row-rendering source
 * actually branches on it.
 */

const ROUTE_PATH = path.resolve(__dirname, '..', 'categories.tsx');
const REORDER_LIST_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'features',
  'categories',
  'components',
  'CategoryReorderList.tsx',
);

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('app/settings/categories.tsx — the four manifest states (brief scope; non-negotiable 6)', () => {
  const source = read(ROUTE_PATH);

  it('does not render RoutePlaceholder', () => {
    expect(source).not.toMatch(/RoutePlaceholder/);
  });

  it('carries testID={fidelityTestId(...)}', () => {
    expect(source).toMatch(/testID=\{fidelityTestId\('settings-categories'\)\}/);
  });

  it('renders the expense/income tabs through Segment, driven by direction', () => {
    expect(source).toMatch(/<Segment/);
    expect(source).toMatch(/value=\{direction\}/);
  });

  it('renders the list through CategoryReorderList, fed by state.rows', () => {
    expect(source).toMatch(/<CategoryReorderList/);
    expect(source).toMatch(/rows=\{state\.rows\}/);
  });

  it("the editor sheet's visible prop is derived from the overlay kind, not a hard-coded boolean (state: edit)", () => {
    expect(source).toMatch(/<CategoryEditorSheet/);
    expect(source).toMatch(/visible=\{overlay\.kind === 'editor'\}/);
  });

  it("the delete modal's visible prop is derived from the overlay kind, not a hard-coded boolean (state: delete-confirm)", () => {
    expect(source).toMatch(/<DeleteCategoryModal/);
    expect(source).toMatch(/visible=\{overlay\.kind === 'delete-confirm'\}/);
  });

  it('deletion calls state.confirmDelete — this route adds no re-parenting logic of its own (Decision 1)', () => {
    expect(source).toMatch(/onConfirm=\{state\.confirmDelete\}/);
    expect(source).not.toMatch(/transactionCategoryId\s*:/);
  });

  it('found in review, PR #97: drives the hook direction from the fidelity preview, so the loaded rows match the previewed tab', () => {
    expect(source).toMatch(/state\.setDirection\(direction\)/);
  });

  it('found in review, PR #97: saveEditor persists the normalized (trimmed) name, not the raw form field', () => {
    expect(source).toMatch(/saveEditor\(\{\s*name:\s*normalizedName/);
  });
});

describe('CategoryReorderList — ✨ Otros renders with no onPress and no drag handle (brief AC2, Decision 3, Resolution R2)', () => {
  const source = read(REORDER_LIST_PATH);

  it('imports isOtrosSlug and branches every affordance on it', () => {
    expect(source).toMatch(/isOtrosSlug/);
  });

  it('onPress is undefined for the fallback row', () => {
    expect(source).toMatch(/onPress=\{isFallback \? undefined/);
  });

  it('trailing (the drag handle) is undefined for the fallback row', () => {
    expect(source).toMatch(/trailing=\{\s*isFallback \? undefined/);
  });

  it('the fallback subtitle is the "default category" copy, not the movement-count copy', () => {
    expect(source).toMatch(/fallback_sub_expense/);
    expect(source).toMatch(/fallback_sub_income/);
  });

  it('found in review, PR #97: the drag handle carries the configured categoryReorderHandle hitSlop, not just its 36px visual box', () => {
    expect(source).toMatch(/hitSlop=\{TOUCH_METRICS\.categoryReorderHandle\.hitSlop\}/);
  });

  it('found in review, PR #97: offsetsRef is reset when the row identity list changes (a tab switch does not remount this component)', () => {
    expect(source).toMatch(/offsetsKeyRef/);
    expect(source).toMatch(/offsetsRef\.current\s*=\s*\[\]/);
  });
});

/**
 * Copy-contract scan (categorization implementation plan's precedent, `copy-contract.test.ts`):
 * every `t('...')` call across this item's new files uses a literal key that exists in the
 * catalogue, and none uses a dynamic (non-literal) key.
 */
describe('settings-categories copy contract (non-negotiable 8)', () => {
  const scannedFiles = [
    ROUTE_PATH,
    REORDER_LIST_PATH,
    path.resolve(path.dirname(REORDER_LIST_PATH), 'CategoryEditorSheet.tsx'),
    path.resolve(path.dirname(REORDER_LIST_PATH), 'DeleteCategoryModal.tsx'),
  ];

  const allKeys: string[] = [];
  const allDynamic: { line: number; column: number }[] = [];
  for (const filePath of scannedFiles) {
    const { keys, dynamic } = findTranslationKeys(read(filePath));
    allKeys.push(...keys);
    allDynamic.push(...dynamic);
  }
  const uniqueKeys = Array.from(new Set(allKeys)).filter((key) => key.startsWith('settings.categories.'));

  it('found settings.categories.* call sites to check', () => {
    expect(uniqueKeys.length).toBeGreaterThan(0);
  });

  it('uses no dynamic (non-literal) key', () => {
    expect(allDynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });
});

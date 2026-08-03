/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 18 (AC33). Scans the
 * three route files, the three screens and their `components/` folder with the shipped
 * `catalogue-key-scan.ts` helper — the same control `gallery-catalogue-keys.test.ts` and
 * `onboarding-catalogue-keys.test.ts` already apply — and checks every found key both exists in
 * `es.json` and matches the plan's Copy contract mapping table character for character. The
 * expected-value map below is transcribed from that table independently of `es.json`, so a
 * future edit that drifts the catalogue from the spec's own copy is caught here rather than by a
 * tautological self-comparison.
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import { findTranslationKeys } from '../../../test-utils/catalogue-key-scan';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', 'categorize');
const FEATURE_ROOT = path.resolve(__dirname, '..');

const SCANNED_FILES = [
  path.join(APP_ROOT, 'intro.tsx'),
  path.join(APP_ROOT, 'index.tsx'),
  path.join(APP_ROOT, 'complete.tsx'),
  path.join(FEATURE_ROOT, 'StageIntroScreen.tsx'),
  path.join(FEATURE_ROOT, 'CategorizeScreen.tsx'),
  path.join(FEATURE_ROOT, 'CategorizeCompleteScreen.tsx'),
  path.join(FEATURE_ROOT, 'components', 'StageTopBar.tsx'),
  path.join(FEATURE_ROOT, 'components', 'StageProgress.tsx'),
  path.join(FEATURE_ROOT, 'components', 'MovementCard.tsx'),
  path.join(FEATURE_ROOT, 'components', 'CategoryGrid.tsx'),
  path.join(FEATURE_ROOT, 'components', 'NotSureDisclosure.tsx'),
  path.join(FEATURE_ROOT, 'components', 'ExcludeSheet.tsx'),
  path.join(FEATURE_ROOT, 'components', 'CompletionSummary.tsx'),
];

/** Transcribed from the implementation plan's "Copy contract mapping" table. */
const EXPECTED_SPANISH: Record<string, string> = {
  'stage_intro.topbar_title': 'Etapa 1',
  'stage_intro.back_a11y': 'Volver',
  'stage_intro.hero_icon': '🎯',
  'stage_intro.heading': 'Tu primera etapa',
  'stage_intro.eyebrow': 'Categorización inteligente',
  'stage_intro.lead':
    'Ya tienes todo configurado. Ahora viene lo divertido: tomar control de tus finanzas paso a paso.',
  'stage_intro.what_title': '¿Qué vamos a hacer?',
  'stage_intro.what_body':
    'Vamos a categorizar tus transacciones recientes juntos. Es rápido, y cada categorización es una pequeña victoria.',
  'stage_intro.step_identify_icon': '🔍',
  'stage_intro.step_identify_title': 'Identificamos',
  'stage_intro.step_identify_sub': 'Gastos por categorizar',
  'stage_intro.step_categorize_icon': '🏷️',
  'stage_intro.step_categorize_title': 'Categorizamos',
  'stage_intro.step_categorize_sub': 'Uno por uno',
  'stage_intro.step_celebrate_icon': '🎉',
  'stage_intro.step_celebrate_title': 'Celebramos',
  'stage_intro.step_celebrate_sub': 'Cada progreso',
  'stage_intro.tile_pending_label': 'Transacciones por categorizar',
  'stage_intro.tile_minutes_label': 'Minutos estimados',
  'stage_intro.tile_minutes_value': '~{{minutes}}',
  'stage_intro.why_title': '¿Por qué es importante?',
  'stage_intro.why_check': '✓',
  'stage_intro.why_visibility_title': 'Visibilidad total',
  'stage_intro.why_visibility_sub': 'Sabrás exactamente en qué gastas tu dinero',
  'stage_intro.why_insights_title': 'Insights inteligentes',
  'stage_intro.why_insights_sub': 'Análisis automáticos de tus patrones de gasto',
  'stage_intro.why_control_title': 'Control gradual',
  'stage_intro.why_control_sub': 'Cada categorización te acerca a tus objetivos',
  'stage_intro.note_icon': '💡',
  'stage_intro.note_strong': 'Flexibilidad total:',
  'stage_intro.note_body': 'puedes parar cuando quieras y continuar después. No hay presión, solo progreso.',
  'stage_intro.start': '🚀 ¡Empezar mi primera etapa!',
  'categorize.topbar_title': 'Categorizar',
  'categorize.back_a11y': 'Volver',
  'categorize.close_a11y': 'Cerrar',
  'categorize.progress': 'Transacción {{current}} de {{total}}',
  'categorize.icon_expense': '💳',
  'categorize.icon_income': '📥',
  'categorize.badge_expense': 'Gasto',
  'categorize.badge_income': 'Ingreso',
  'categorize.datetime': '{{date}} · {{time}}',
  'categorize.merchant_edit_icon': '✏️',
  'categorize.merchant_edit_hint': 'Toca para editar',
  'categorize.description_label': 'Descripción del banco',
  'categorize.question_expense': '¿En qué categoría lo pones?',
  'categorize.question_income': '¿De qué tipo de ingreso se trata?',
  'categorize.suggested_star': '✨',
  'categorize.suggested_hint': 'Sugerido',
  'categorize.choose_other_emoji': '🔲',
  'categorize.choose_other': 'Elegir otra',
  'categorize.not_sure_icon': '🤔',
  'categorize.not_sure': '¿No estás seguro?',
  'categorize.review_later_icon': '🕒',
  'categorize.review_later_title': 'Revisar más tarde',
  'categorize.review_later_sub': 'Lo veré después',
  'categorize.uncertain_icon': '❓',
  'categorize.uncertain_title': 'No recuerdo',
  'categorize.uncertain_sub': 'No estoy seguro de qué fue',
  'categorize.exclude_icon': '🚫',
  'categorize.exclude_title': 'Excluir del análisis',
  'categorize.exclude_sub': 'No es un gasto propio',
  'categorize.skip': 'Omitir',
  'categorize.next': 'Siguiente →',
  'categorize.write_failed_icon': '⚠️',
  'categorize.write_failed': 'No pudimos guardar esa decisión. Inténtalo de nuevo.',
  'categorize.exclude_sheet_title': '🚫 Excluir del análisis',
  'categorize.exclude_sheet_question': '¿Por qué quieres excluir esta transacción?',
  'categorize.exclude_reason_personal_transfer': 'Transferencia personal',
  'categorize.exclude_reason_shared_expense': 'Involucra a más personas',
  'categorize.exclude_reason_not_relevant': 'Gasto no relevante',
  'categorize.exclude_reason_cash_withdrawal': 'Retiro de efectivo',
  'categorize.exclude_reason_other': 'Otro',
  'categorize.exclude_note_placeholder': 'Explica brevemente (opcional)',
  'categorize.exclude_cancel': 'Cancelar',
  'categorize.exclude_confirm': 'Confirmar',
  'categorize_complete.celebration_icon': '🎉',
  'categorize_complete.heading_partial': '¡Buen trabajo!',
  'categorize_complete.lead_partial': 'Categorizaste las transacciones recientes.',
  'categorize_complete.heading_done': '¡Increíble trabajo!',
  'categorize_complete.lead_done': 'Has organizado completamente tus transacciones.',
  'categorize_complete.counter_label': 'Total categorizado',
  'categorize_complete.counter_partial': '{{resolved}} / {{total}}',
  'categorize_complete.counter_done': '{{total}}',
  'categorize_complete.counter_sub': 'transacciones organizadas',
  'categorize_complete.progress_a11y': 'Progreso de la etapa',
  'categorize_complete.tile_daily_label': 'Gasto diario promedio',
  'categorize_complete.tile_daily_sub': 'este mes',
  'categorize_complete.tile_change_label': 'vs mes pasado',
  'categorize_complete.tile_change_sub_less': 'estás gastando menos',
  'categorize_complete.tile_change_sub_more': 'estás gastando más',
  'categorize_complete.tile_change_sub_same': 'igual que el mes pasado',
  'categorize_complete.continue': 'Seguir categorizando',
  'categorize_complete.done_for_today': 'Terminado por hoy',
  'categorize_complete.go_home': 'Continuar a inicio',
  'categorize_complete.closing': '¡Ahora tienes una vista completa de tus gastos!',
};

function scanAll(): { keys: string[]; dynamic: { file: string; line: number; column: number }[] } {
  const keys: string[] = [];
  const dynamic: { file: string; line: number; column: number }[] = [];

  for (const file of SCANNED_FILES) {
    const source = fs.readFileSync(file, 'utf8');
    const result = findTranslationKeys(source);
    keys.push(...result.keys);
    dynamic.push(...result.dynamic.map((finding) => ({ file: path.basename(file), ...finding })));
  }

  return { keys, dynamic };
}

describe('categorization screens copy contract (AC33)', () => {
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

  it('uses no dynamic (non-literal) key anywhere in the categorization screens', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  /**
   * `categorize.suggested_star` (✨) is defined for spec/plan completeness (Copy contract
   * mapping) but is not independently rendered by this item: the shipped `CategoryChip`
   * primitive (item #2, out of scope here) already draws its own suggestion-state star glyph
   * internally when `state="suggested"`. Wiring a second star from this catalogue key would draw
   * two stars on one chip, not match the mockup's single one — a pre-existing design-system
   * constraint, not a gap this item introduces.
   */
  const NOT_INDEPENDENTLY_RENDERED = new Set(['categorize.suggested_star']);

  const categorizationCatalogueKeys = Object.keys(es).filter(
    (key) =>
      key.startsWith('stage_intro.') || key.startsWith('categorize.') || key.startsWith('categorize_complete.'),
  );

  it.each(categorizationCatalogueKeys.filter((key) => !NOT_INDEPENDENTLY_RENDERED.has(key)))(
    'catalogue key %s is used by a screen or component',
    (key) => {
      expect(uniqueKeys).toContain(key);
    },
  );

  const expectedKeys = Object.keys(EXPECTED_SPANISH);

  it('the expected-value map covers every categorization catalogue key', () => {
    expect(expectedKeys.sort()).toEqual(categorizationCatalogueKeys.sort());
  });

  it.each(expectedKeys)('es.json value for %s matches the Copy contract table character for character', (key) => {
    expect((es as Record<string, string>)[key]).toBe(EXPECTED_SPANISH[key]);
  });
});

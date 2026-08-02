/**
 * Copy for the `__DEV__`-only design-system gallery route, in a flat `ds.*`-keyed object.
 *
 * This item does **not** bootstrap `apps/mobile/src/i18n/` (Decision 9) — the gallery is
 * dev-only and never reaches a user, and per Decision 3 no primitive itself contains copy.
 * Values here are Spanish (es-CL), taken verbatim from `#screen=ds-typography` and
 * `#screen=ds-components` where the mockup already has the exact copy, and written in the same
 * voice elsewhere. This object is meant to move mechanically into an `es.json` catalogue once
 * that infrastructure lands.
 */
export const galleryStrings = {
  'ds.gallery.title': 'Sistema de diseño',

  // Section 1 — Botones (#screen=ds-components)
  'ds.section.buttons': 'Botones',
  'ds.button.primary': 'Primario',
  'ds.button.muted': 'Primario deshabilitado',
  'ds.button.outline': 'Secundario',
  'ds.button.ghost': 'Terciario',
  'ds.button.danger': 'Destructivo',
  'ds.button.dangerSoft': 'Destructivo suave',
  'ds.button.small': 'Pequeño',

  // Section 2 — Badges (#screen=ds-components)
  'ds.section.badges': 'Badges',
  'ds.badge.neutral': 'Neutro',
  'ds.badge.ok': 'Al día',
  'ds.badge.warn': 'Pendiente',
  'ds.badge.danger': 'Error',
  'ds.badge.info': 'Info',
  'ds.badge.celebration': 'Logro',

  // Section 3 — Chips de categoría (#screen=ds-components)
  'ds.section.categoryChips': 'Chips de categoría',
  'ds.categoryChip.suggestedEmoji': '📦',
  'ds.categoryChip.suggestedLabel': 'Sugerido',
  'ds.categoryChip.selectedEmoji': '🍔',
  'ds.categoryChip.selectedLabel': 'Elegido',
  'ds.categoryChip.defaultEmoji': '🚗',
  'ds.categoryChip.defaultLabel': 'Normal',

  // Section 4 — Campos (#screen=ds-components)
  'ds.section.fields': 'Campos',
  'ds.field.emailLabel': 'Correo electrónico',
  'ds.field.emailPlaceholder': 'Placeholder',
  'ds.field.emailFocusedValue': 'Con foco',
  'ds.field.emailErrorValue': 'Con error',
  'ds.field.emailErrorHint': 'Mensaje de error',
  'ds.field.emailLockedValue': 'Bloqueado 🔒',
  'ds.field.checkboxLabel': 'Categorizar automáticamente',
  'ds.field.radioLabel': 'Incluir en el análisis',
  'ds.field.switchLabel': 'Notificaciones activas',

  // Section 5 — Transacciones (#screen=ds-components)
  'ds.section.transactions': 'Transacciones',
  'ds.transaction.categorizedIcon': '🛒',
  'ds.transaction.categorizedName': 'Categorizada',
  'ds.transaction.categorizedMeta': '24 ene · Comida',
  'ds.transaction.categorizedAmount': '$35.000',
  'ds.transaction.pendingIcon': '💳',
  'ds.transaction.pendingName': 'Pendiente',
  'ds.transaction.pendingMeta': '⚠️ Necesita categorización',
  'ds.transaction.pendingAmount': '$42.000',
  'ds.transaction.excludedIcon': '🚫',
  'ds.transaction.excludedName': 'Excluida',
  'ds.transaction.excludedMeta': '14 ene · Fuera del análisis',
  'ds.transaction.excludedAmount': '$75.000',

  // Section 6 — Avisos (#screen=ds-components)
  'ds.section.notes': 'Avisos',
  'ds.note.info': 'Informativo',
  'ds.note.infoIcon': 'ℹ️',
  'ds.note.ok': 'Éxito / seguridad',
  'ds.note.okIcon': '🔒',
  'ds.note.warn': 'Advertencia',
  'ds.note.warnIcon': '⚠️',
  'ds.note.danger': 'Error',
  'ds.note.dangerIcon': '⛔',

  // Section 7 — Stat tiles (#screen=ds-components)
  'ds.section.statTiles': 'Stat tiles',
  'ds.stat.incomeLabel': 'Ingresos',
  'ds.stat.incomeValue': '3.7M',
  'ds.stat.incomeSub': '2 movimientos',
  'ds.stat.expenseLabel': 'Gastos',
  'ds.stat.expenseValue': '1.4M',
  'ds.stat.expenseSub': '24 movimientos',

  // Section 8 — Tipografía (#screen=ds-typography)
  'ds.section.typography': 'Tipografía',
  'ds.typography.intro': 'Familia: system UI stack. Números tabulares en montos.',
  'ds.typography.h1': 'Display · 28/800',
  'ds.typography.h1Caption': '.mu-h1 · títulos de pantalla',
  'ds.typography.h2': 'Heading lg · 20/700',
  'ds.typography.h2Caption': '.mu-h2 · secciones',
  'ds.typography.h3': 'Heading md · 16/700',
  'ds.typography.h3Caption': '.mu-h3 · títulos de card',
  'ds.typography.body': 'Body md · 14/1.55 — texto corrido, descripciones y ayuda contextual.',
  'ds.typography.bodyCaption': '.mu-p',
  'ds.typography.small': 'Body sm · 12 — metadatos, subtítulos.',
  'ds.typography.smallCaption': '.mu-small',
  'ds.typography.eyebrow': 'Eyebrow · 11/700 · +0.1em',
  'ds.typography.eyebrowCaption': '.mu-eyebrow',

  // Section 9 — Montos (#screen=ds-typography)
  'ds.section.amounts': 'Montos',
  'ds.amount.hero': '$1.200.000',
  'ds.amount.heroCaption': '.mu-amount--hero · 32/800',
  'ds.amount.in': '+$2.500.000',
  'ds.amount.inCaption': '--in',
  'ds.amount.out': '$35.000',
  'ds.amount.outCaption': '--out',
  'ds.amount.hint':
    'Formato CLP: punto como separador de miles, sin decimales. Ingresos con signo +; gastos sin signo.',

  // Section 10 — Cards
  'ds.section.cards': 'Cards',
  'ds.card.defaultTitle': 'Card por defecto',
  'ds.card.defaultSub': 'Padding estándar y sombra',
  'ds.card.tightTitle': 'Card compacta',
  'ds.card.tightSub': 'Padding reducido',
  'ds.card.flatTitle': 'Card plana',
  'ds.card.flatSub': 'Sin sombra, fondo secundario',

  // Section 11 — Hero (#screen=home&state=pending)
  'ds.section.hero': 'Hero',
  'ds.hero.icon': '🎯',
  'ds.hero.title': 'Vamos a categorizar',
  'ds.hero.subtitle': '12 movimientos esperando',

  // Section 12 — Segmentos y pills
  'ds.section.segmentsAndPills': 'Segmentos y pills',
  'ds.segment.optionWeek': 'Semana',
  'ds.segment.optionMonth': 'Mes',
  'ds.pill.optionAll': 'Todas',
  'ds.pill.optionIncome': 'Ingresos',
  'ds.pill.optionExpense': 'Gastos',

  // Section 13 — Progreso
  'ds.section.progress': 'Progreso',
  'ds.progress.label': 'Progreso de sincronización',
  'ds.steps.label': 'Paso 2 de 4',
  'ds.dots.label': 'Página 2 de 4',

  // Section 14 — Estado vacío (#screen=bank-picker&state=no-results)
  'ds.section.emptyState': 'Estado vacío',
  'ds.emptyState.icon': '🔍',
  'ds.emptyState.title': 'Sin resultados',
  'ds.emptyState.description': 'No encontramos bancos con ese nombre',
  'ds.emptyState.action': 'Reintentar',

  // Section 15 — Tab bar (#screen=home)
  'ds.section.tabBar': 'Tab bar',
  'ds.tabBar.homeIcon': '🏠',
  'ds.tabBar.homeLabel': 'Inicio',
  'ds.tabBar.transactionsIcon': '📄',
  'ds.tabBar.transactionsLabel': 'Transacciones',

  // Section 16 — Sheet y modal
  'ds.section.sheetAndModal': 'Sheet y modal',
  'ds.sheet.openLabel': 'Abrir sheet',
  'ds.sheet.content': 'Contenido del sheet de ejemplo.',
  'ds.modal.openLabel': 'Abrir modal',
  'ds.modal.icon': '🗑️',
  'ds.modal.title': '¿Borrar todos mis datos?',
  'ds.modal.body': 'Esta acción no se puede deshacer.',
  'ds.modal.confirmLabel': 'Borrar',
  'ds.modal.cancelLabel': 'Cancelar',
} as const;

export type GalleryStringKey = keyof typeof galleryStrings;

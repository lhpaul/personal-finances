/**
 * Classification of every `mu-*` class found in `design/mockups/mobile/index.html`'s
 * `<style>` block into exactly one status: `primitive` (built by one of this item's 23
 * components), `utility` (a layout/spacing helper with no component of its own — the consumer
 * applies `theme` / `componentMetrics` directly), or `deferred` (a real primitive that is out
 * of this item's scope, with the owning backlog item named in `note`).
 *
 * This is the residual-verification mechanism for AC2 ("every mu-* primitive in the mockups
 * has a component"), a pattern-completeness claim. Two Jest assertions in
 * `apps/mobile/src/__tests__/mu-class-coverage.test.ts` hold it:
 *
 * 1. Exhaustive classification: every class returned by `muClassInventory()` has an entry
 *    here, and every entry here is a real class in the stylesheet.
 * 2. Component resolution: every `primitive` entry's `owners` all resolve to a barrel export
 *    of `apps/mobile/src/components/ui/index.ts`, and every `internalOwners` path resolves to
 *    an existing module without being a barrel export.
 *
 * See the implementation plan's "mu-class Classification (AC2)" section for the full
 * rationale and the deferred-class table:
 * docs/specs/developments/20260801172100_2-theme-design-system-primitives/
 * 2_2-theme-design-system-primitives_implementation-plan.md
 */

export type MuClassStatus = 'primitive' | 'utility' | 'deferred';

export type MuClassEntry = {
  status: MuClassStatus;
  /** Required (non-empty) when status === 'primitive'. A class may have more than one owner:
   * `.mu-overlay` is rendered by both `Sheet` and `Modal`, so both are listed. */
  owners?: readonly string[];
  /** Components that implement the class but are deliberately not part of the public barrel
   * (today: only `_internal/Overlay`, shared by `Sheet` and `Modal`). Listed by module path
   * relative to `src/components/ui/`. */
  internalOwners?: readonly string[];
  /** Required when status !== 'primitive': why, and which item owns it. */
  note?: string;
};

export const MU_CLASS_MAP: Record<string, MuClassEntry> = {
  'mu-amount': { status: 'primitive', owners: ['Amount'] },
  'mu-amount--hero': { status: 'primitive', owners: ['Amount'] },
  'mu-amount--in': { status: 'primitive', owners: ['Amount'] },
  'mu-amount--out': { status: 'primitive', owners: ['Amount'] },
  'mu-badge': { status: 'primitive', owners: ['Badge'] },
  'mu-badge--celebration': { status: 'primitive', owners: ['Badge'] },
  'mu-badge--danger': { status: 'primitive', owners: ['Badge'] },
  'mu-badge--info': { status: 'primitive', owners: ['Badge'] },
  'mu-badge--ok': { status: 'primitive', owners: ['Badge'] },
  'mu-badge--warn': { status: 'primitive', owners: ['Badge'] },
  'mu-bank': { status: 'primitive', owners: ['BankRow'] },
  'mu-bank__logo': { status: 'primitive', owners: ['BankRow'] },
  'mu-bank__name': { status: 'primitive', owners: ['BankRow'] },
  'mu-bars': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-bars__bar': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-bars__bar--muted': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-bars__bar--warm': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-bars__col': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-bars__lbl': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-btn': { status: 'primitive', owners: ['Button'] },
  'mu-btn--auto': { status: 'primitive', owners: ['Button'] },
  'mu-btn--danger': { status: 'primitive', owners: ['Button'] },
  'mu-btn--danger-soft': { status: 'primitive', owners: ['Button'] },
  'mu-btn--ghost': { status: 'primitive', owners: ['Button'] },
  'mu-btn--muted': { status: 'primitive', owners: ['Button'] },
  'mu-btn--outline': { status: 'primitive', owners: ['Button'] },
  'mu-btn--sm': { status: 'primitive', owners: ['Button'] },
  'mu-btn-row': { status: 'utility' },
  'mu-btn-stack': { status: 'utility' },
  'mu-card': { status: 'primitive', owners: ['Card'] },
  'mu-card--flat': { status: 'primitive', owners: ['Card'] },
  'mu-card--tight': { status: 'primitive', owners: ['Card'] },
  'mu-card__head': { status: 'primitive', owners: ['Card'] },
  'mu-card__sub': { status: 'primitive', owners: ['Card'] },
  'mu-card__title': { status: 'primitive', owners: ['Card'] },
  'mu-cat-row': { status: 'primitive', owners: ['CategoryRow'] },
  'mu-cat-row__bar': { status: 'primitive', owners: ['CategoryRow'] },
  'mu-cat-row__fill': { status: 'primitive', owners: ['CategoryRow'] },
  'mu-cat-row__icon': { status: 'primitive', owners: ['CategoryRow'] },
  'mu-center': { status: 'primitive', owners: ['Text'] },
  'mu-check': { status: 'primitive', owners: ['Checkbox'] },
  'mu-chip': { status: 'primitive', owners: ['CategoryChip'] },
  'mu-chip__emoji': { status: 'primitive', owners: ['CategoryChip'] },
  'mu-chip__hint': { status: 'primitive', owners: ['CategoryChip'] },
  'mu-chip__star': { status: 'primitive', owners: ['CategoryChip'] },
  'mu-donut': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-dots': { status: 'primitive', owners: ['Dots'] },
  'mu-dots__dot': { status: 'primitive', owners: ['Dots'] },
  'mu-draft': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-empty': { status: 'primitive', owners: ['EmptyState'] },
  'mu-empty__icon': { status: 'primitive', owners: ['EmptyState'] },
  'mu-eyebrow': { status: 'primitive', owners: ['Text'] },
  'mu-field': { status: 'primitive', owners: ['TextField'] },
  'mu-grid-2': { status: 'utility' },
  'mu-grid-3': { status: 'utility' },
  'mu-h1': { status: 'primitive', owners: ['Text'] },
  'mu-h2': { status: 'primitive', owners: ['Text'] },
  'mu-h3': { status: 'primitive', owners: ['Text'] },
  'mu-head': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head--plain': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__action': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__action--brand': { status: 'deferred', note: 'ScreenHeader modifier not drawn by any MVP screen yet; still deferred (originally misassigned to #12, corrected here now that #12 ships ScreenHeader without needing it).' },
  'mu-head__action--dot': { status: 'deferred', note: 'ScreenHeader modifier not drawn by any MVP screen yet; still deferred (originally misassigned to #12, corrected here now that #12 ships ScreenHeader without needing it).' },
  'mu-head__avatar': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__avatar--brand': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__sub': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__title': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-head__txt': { status: 'primitive', owners: ['ScreenHeader'] },
  'mu-hero': { status: 'primitive', owners: ['Hero'] },
  'mu-hero__icon': { status: 'primitive', owners: ['Hero'] },
  'mu-hero__row': { status: 'primitive', owners: ['Hero'] },
  'mu-hero__sub': { status: 'primitive', owners: ['Hero'] },
  'mu-hero__title': { status: 'primitive', owners: ['Hero'] },
  'mu-hint': { status: 'primitive', owners: ['Text'] },
  'mu-hint--error': { status: 'primitive', owners: ['Text'] },
  'mu-input': { status: 'primitive', owners: ['TextField'] },
  'mu-input--ph': { status: 'primitive', owners: ['TextField'] },
  'mu-item': { status: 'deferred', note: 'Deferred to #19 (Settings hub).' },
  'mu-item__chev': { status: 'primitive', owners: ['BankRow'] },
  'mu-item__icon': { status: 'deferred', note: 'Deferred to #19 (Settings hub).' },
  'mu-item__sub': { status: 'primitive', owners: ['BankRow'] },
  'mu-item__title': { status: 'deferred', note: 'Deferred to #19 (Settings hub).' },
  'mu-item__txt': { status: 'primitive', owners: ['CategoryRow', 'BankRow'] },
  'mu-label': { status: 'primitive', owners: ['Text'] },
  'mu-legend': { status: 'primitive', owners: ['Legend'] },
  'mu-legend__dot': { status: 'primitive', owners: ['Legend'] },
  'mu-legend__name': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-legend__row': { status: 'primitive', owners: ['Legend'] },
  'mu-legend__val': { status: 'deferred', note: 'Deferred to #17 (Dashboard charts).' },
  'mu-line': { status: 'primitive', owners: ['LineChart'] },
  'mu-list': { status: 'deferred', note: 'Deferred to #19 (Settings hub).' },
  'mu-modal': { status: 'primitive', owners: ['Modal'] },
  'mu-modal__icon': { status: 'primitive', owners: ['Modal'] },
  'mu-mono': { status: 'primitive', owners: ['Text'] },
  'mu-mt1': { status: 'utility' },
  'mu-mt2': { status: 'utility' },
  'mu-mt3': { status: 'utility' },
  'mu-mt4': { status: 'utility' },
  'mu-mt5': { status: 'utility' },
  'mu-mt6': { status: 'utility' },
  'mu-note': { status: 'primitive', owners: ['Note'] },
  'mu-note--danger': { status: 'primitive', owners: ['Note'] },
  'mu-note--ok': { status: 'primitive', owners: ['Note'] },
  'mu-note--warn': { status: 'primitive', owners: ['Note'] },
  'mu-note__icon': { status: 'primitive', owners: ['Note'] },
  'mu-otp': { status: 'deferred', note: 'Deferred to #7 (sign-in, out of the MVP).' },
  'mu-otp__box': { status: 'deferred', note: 'Deferred to #7 (sign-in, out of the MVP).' },
  'mu-overlay': { status: 'primitive', owners: ['Sheet', 'Modal'], internalOwners: ['_internal/Overlay'] },
  'mu-overlay--center': { status: 'primitive', owners: ['Sheet', 'Modal'], internalOwners: ['_internal/Overlay'] },
  'mu-p': { status: 'primitive', owners: ['Text'] },
  'mu-p--lead': { status: 'primitive', owners: ['Text'] },
  'mu-pad': { status: 'utility' },
  'mu-pad-b': { status: 'utility' },
  'mu-pill': { status: 'primitive', owners: ['Pill'] },
  'mu-pill-row': { status: 'utility' },
  'mu-progress': { status: 'primitive', owners: ['Progress'] },
  'mu-progress__fill': { status: 'primitive', owners: ['Progress'] },
  'mu-radio': { status: 'primitive', owners: ['Radio'] },
  'mu-row': { status: 'utility' },
  'mu-row--between': { status: 'utility' },
  'mu-safe-top': { status: 'utility' },
  'mu-scroll': { status: 'utility' },
  'mu-segment': { status: 'primitive', owners: ['Segment'] },
  'mu-segment__item': { status: 'primitive', owners: ['Segment'] },
  'mu-sheet': { status: 'primitive', owners: ['Sheet'] },
  'mu-sheet__grab': { status: 'primitive', owners: ['Sheet'] },
  'mu-small': { status: 'primitive', owners: ['Text'] },
  'mu-spacer': { status: 'utility' },
  'mu-stat': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat--in': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat--out': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat__arrow': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat__label': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat__sub': { status: 'primitive', owners: ['StatTile'] },
  'mu-stat__value': { status: 'primitive', owners: ['StatTile'] },
  'mu-steps': { status: 'primitive', owners: ['Steps'] },
  'mu-steps__step': { status: 'primitive', owners: ['Steps'] },
  'mu-swatch': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-swatch__chip': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-swatch__hex': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-swatch__meta': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-swatch__name': { status: 'deferred', note: 'Mockup-viewer chrome; no product component.' },
  'mu-switch': { status: 'primitive', owners: ['Switch'] },
  'mu-tabbar': { status: 'primitive', owners: ['TabBar'] },
  'mu-tabbar__icon': { status: 'primitive', owners: ['TabBar'] },
  'mu-tabbar__item': { status: 'primitive', owners: ['TabBar'] },
  'mu-topbar': { status: 'deferred', note: 'Deferred to #8 (Onboarding) — the earliest MVP screen (onboarding-value) that draws a topbar. Corrected from an earlier note that named #12, which #screen=home never draws.' },
  'mu-topbar__btn': { status: 'deferred', note: 'Deferred to #8 (Onboarding) — the earliest MVP screen (onboarding-value) that draws a topbar. Corrected from an earlier note that named #12, which #screen=home never draws.' },
  'mu-topbar__title': { status: 'deferred', note: 'Deferred to #8 (Onboarding) — the earliest MVP screen (onboarding-value) that draws a topbar. Corrected from an earlier note that named #12, which #screen=home never draws.' },
  'mu-topbar__title--left': { status: 'deferred', note: 'Deferred to #8 (Onboarding) — the earliest MVP screen (onboarding-value) that draws a topbar. Corrected from an earlier note that named #12, which #screen=home never draws.' },
  'mu-tx': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx--excluded': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx--pending': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx-group': { status: 'utility' },
  'mu-tx__amount': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__amount--in': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__icon': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__meta': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__meta--warn': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__name': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-tx__txt': { status: 'primitive', owners: ['TransactionRow'] },
  'mu-xs': { status: 'primitive', owners: ['Text'] },
};

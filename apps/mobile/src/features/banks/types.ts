import type { AmountTone, BadgeTone } from '../../components/ui';

/** A catalogue key plus its interpolation values — never a Spanish string built in TypeScript
 * (AGENTS.md non-negotiable 8; implementation plan for issue #20, Decision 3). */
export interface CopyFragment {
  key: string;
  values: Record<string, string | number>;
}

/** `settings-banks`'s per-row derived presentation (Decision 3, Decision 4). `subLabel` is a
 * discriminated union rather than one pre-composed string: a healthy connection's sub-label is
 * `settings_banks.row_subtitle`, composed from two independently-translated fragments (`{{sync}}`
 * `·` `{{products}}`), while an errored connection's sub-label is a single override fragment
 * (Assumption A8) — no pure function here can call `t()`, so the composition itself happens at
 * the component. */
export interface BankConnectionListItem {
  badgeTone: 'ok' | 'danger';
  badgeLabelKey: 'settings_banks.badge_ok' | 'settings_banks.badge_error';
  /** Decision 4: the row's accessible name is composed as bank name + this status word
   * (`"Al día"` / `"Error"`), not the visible relative-time `subLabel` — see `BankRow`'s
   * `accessibilityLabel` override. */
  accessibilityStatusKey: 'settings_banks.status_ok' | 'settings_banks.status_error';
  subLabelTone: 'default' | 'danger';
  subLabel:
    | { kind: 'composed'; syncFragment: CopyFragment; productCountFragment: CopyFragment }
    | { kind: 'override'; fragment: CopyFragment };
}

export type BankReviewState = 'ok' | 'error';

/** `bank-review`'s "Productos" row shape (Decision 5). `metaFragment` is `undefined` exactly when
 * the product carries neither a mask nor a credit limit (no meta line at all); `amount` is
 * `undefined` exactly when `balanceMinorUnits` is absent — never a `0` stand-in, which would be a
 * claim the store never made. */
export interface BankProductView {
  icon: string;
  title: string;
  metaFragment: CopyFragment | undefined;
  amount: { minorUnits: number; tone: AmountTone } | undefined;
}

export type { BadgeTone };
export type { DisconnectOutcome } from './disconnect-bank.service';

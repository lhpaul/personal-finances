import type { TFunction } from 'i18next';

import type { CopyFragment } from './types';

/**
 * The one place this feature calls `t()` with a key it does not know at compile time
 * (implementation plan for issue #20). Every {@link CopyFragment} this feature produces carries a
 * key from this module's own closed catalogue set (`connection-view.ts`, `sync-error-copy.ts`,
 * `product-view.ts`) — verified against both `es.json` and `en.json` by `catalogue-parity.test.ts`
 * and exercised branch-by-branch by this feature's own unit and screen tests. i18next's generated
 * literal-key typing (`i18next.d.ts`) cannot express "one of these N keys, resolved at runtime
 * through several composed fragments" the way item #12's/#15's `Record<key, string> as const
 * satisfies` maps do for a single flat lookup (`docs/best-practices/stack/i18n.md`); this feature
 * threads a fragment through a stored, generally-typed field (`BankConnectionListItem`,
 * `BankProductView`) before it reaches a component, which erases the literal narrowing a direct
 * call-site switch would otherwise preserve. One narrow, documented cast here replaces what would
 * otherwise be a scattered, unreviewable cast at every render call site.
 */
export function translateFragment(t: TFunction, fragment: CopyFragment): string {
  const untypedT = t as unknown as (key: string, values?: Record<string, unknown>) => string;
  return untypedT(fragment.key, fragment.values);
}

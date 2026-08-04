import { useTranslation } from 'react-i18next';

import { BankRow, Badge } from '../../../components/ui';
import type { SupportedLocale } from '../../../db/labels';
import { theme } from '../../../theme';
import type { BankConnectionSummary } from '../../../db/types';
import { monogramFor, resolveConnectionListItem } from '../connection-view';
import { translateFragment } from '../translate-fragment';

export interface ConnectedBankRowProps {
  connection: BankConnectionSummary;
  now: Date;
  locale: SupportedLocale;
  onPress: (institutionId: string) => void;
}

/**
 * Composes item #12's `BankRow` with the settings row's badge and sub-label (implementation plan
 * for issue #20, Decision 3, Decision 4). The mockup's trailing element is a `mu-badge--ok`
 * ("✓"), not the chevron `BankRow` draws by default — the shipped `BankRow.tsx` already carried
 * an additive `trailingAccessory` slot for exactly this (built by item #9, ahead of this item's
 * plan-time assumption of an additive `badge` prop; re-verification step 7's own contingency: "if
 * #12 already shipped a trailing slot under another name, use it and add nothing"). The row's
 * accessible name is separately overridden to "<name>, <status word>"
 * (`settings_banks.status_ok` / `status_error`), per Decision 4 — the visible badge glyph ("✓")
 * is not itself announced when it sits inside a `Pressable` with an explicit
 * `accessibilityLabel`, so this is the only additive `BankRow` change this item makes.
 */
export function ConnectedBankRow({ connection, now, locale, onPress }: ConnectedBankRowProps) {
  const { t } = useTranslation();
  const item = resolveConnectionListItem(connection, now, locale);

  const subLabel =
    item.subLabel.kind === 'override'
      ? translateFragment(t, item.subLabel.fragment)
      : t('settings_banks.row_subtitle', {
          sync: translateFragment(t, item.subLabel.syncFragment),
          products: translateFragment(t, item.subLabel.productCountFragment),
        });

  return (
    <BankRow
      monogram={monogramFor(connection)}
      monogramColor={connection.brandColor ?? theme.colors.brandPrimary}
      name={connection.name}
      subLabel={subLabel}
      subLabelTone={item.subLabelTone}
      onPress={() => onPress(connection.institutionId)}
      trailingAccessory={<Badge tone={item.badgeTone} label={t(item.badgeLabelKey)} />}
      accessibilityLabel={`${connection.name}, ${t(item.accessibilityStatusKey)}`}
    />
  );
}

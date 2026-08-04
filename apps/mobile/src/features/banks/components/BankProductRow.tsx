import { formatClp } from '@finanzas/shared-utils';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Amount, Card, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';
import type { BankProductSummary } from '../../../db/types';
import { toProductView } from '../product-view';
import { translateFragment } from '../translate-fragment';

/**
 * `.mu-item__icon`, `__title`, `__sub mu-mono` and `.mu-amount` inside a `mu-card mu-card--tight`
 * row (implementation plan for issue #20, Decision 5). Screen-local, not a `components/ui/`
 * primitive: `mu-class-coverage.test.ts` requires every `MU_CLASS_MAP` owner to be a barrel
 * export, and item #19's `ListRow` already owns `mu-item__icon`/`__title` for the screens that
 * draw `mu-item` directly. Geometry is transcribed straight from the mockup's own
 * `.mu-item__icon`/`__title`/`__sub` CSS rules rather than a shared `componentMetrics.listRow`
 * group: item #19 (which would own that group) has not merged at this item's implementation
 * time. Converging the two into one shared metrics group once #19 lands is left as a follow-up
 * (Decision 5, Resolution R3).
 */
const ICON_SIZE = 40; // `.mu-item__icon` width/height
const ICON_FONT_SIZE = 19; // `.mu-item__icon` font-size
const TITLE_FONT_SIZE = 15; // `.mu-item__title` font-size
const SUB_MARGIN_TOP = 1; // `.mu-item__sub` margin-top

export interface BankProductRowProps {
  product: BankProductSummary;
}

export function BankProductRow({ product }: BankProductRowProps) {
  const { t } = useTranslation();
  const view = toProductView(product, (minorUnits) => formatClp(minorUnits));

  return (
    <Card variant="tight">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
        <View
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface3,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text style={{ fontSize: ICON_FONT_SIZE }}>{view.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: TITLE_FONT_SIZE, fontWeight: fontWeight(theme.typography.weight.semibold) }}>
            {view.title}
          </Text>
          {view.metaFragment !== undefined && (
            <Text
              variant="mono"
              tone="secondary"
              style={{ fontSize: theme.typography.size.sm, marginTop: SUB_MARGIN_TOP }}
            >
              {translateFragment(t, view.metaFragment)}
            </Text>
          )}
        </View>
        {view.amount !== undefined && (
          <Amount
            minorUnits={view.amount.minorUnits}
            tone={view.amount.tone}
            format={(minorUnits) => formatClp(minorUnits)}
          />
        )}
      </View>
    </Card>
  );
}

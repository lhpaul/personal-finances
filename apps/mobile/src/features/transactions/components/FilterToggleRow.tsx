import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Switch, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

export interface FilterToggleRowProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

/** `.mu-list` + one `.mu-item` (implementation plan for issue #15, Decision 11 — both classes
 * are `deferred` to #19; composed screen-locally here, `MU_CLASS_MAP` unchanged). The **Mostrar
 * excluidas** row: title, sub-label, and a `Switch`. */
export function FilterToggleRow({ value, onValueChange }: FilterToggleRowProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        marginTop: theme.space['4'],
        backgroundColor: theme.colors.surface1,
        borderRadius: theme.radius.card,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: theme.colors.border,
        shadowColor: componentMetrics.shadow.black,
        shadowOpacity: componentMetrics.shadow.card.opacity,
        shadowRadius: componentMetrics.shadow.card.radius,
        shadowOffset: { width: 0, height: componentMetrics.shadow.card.offsetY },
        elevation: componentMetrics.shadow.card.elevation,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space['3'],
          paddingVertical: theme.space['4'],
          paddingHorizontal: theme.space['5'],
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: screenMetrics.transactions.filterToggleTitleFontSize,
              fontWeight: fontWeight(theme.typography.weight.semibold),
            }}
          >
            {t('transactions.filter_show_excluded_title')}
          </Text>
          <Text
            variant="small"
            tone="secondary"
            style={{ marginTop: screenMetrics.transactions.filterToggleSubMarginTop }}
          >
            {t('transactions.filter_show_excluded_sub')}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={t('transactions.filter_show_excluded_title')}
        />
      </View>
    </View>
  );
}

import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent, type TextStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type TransactionRowDirection = 'in' | 'out';
export type TransactionRowState = 'default' | 'pending' | 'excluded';
export type TransactionRowMetaTone = 'default' | 'warn';

export type TransactionRowProps = {
  icon: ReactNode;
  name: string;
  meta: string;
  amount: string;
  direction: TransactionRowDirection;
  state?: TransactionRowState;
  metaTone?: TransactionRowMetaTone;
  onPress?: (event: GestureResponderEvent) => void;
};

/** `.mu-tx`, `--pending`, `--excluded`, `__icon`, `__txt`, `__name`, `__meta`, `__meta--warn`,
 * `__amount`, `__amount--in`. */
export function TransactionRow({
  icon,
  name,
  meta,
  amount,
  direction,
  state = 'default',
  metaTone = 'default',
  onPress,
}: TransactionRowProps) {
  const touchMetrics = TOUCH_METRICS.transactionRow;
  const isPending = state === 'pending';
  const isExcluded = state === 'excluded';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}, ${amount}`}
      onPress={onPress}
      hitSlop={touchMetrics?.hitSlop}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space['3'],
          width: '100%',
          padding: theme.space['3'],
          paddingHorizontal: theme.space['4'],
          borderRadius: theme.radius.lg,
          backgroundColor: isPending ? theme.colors.warningBg : theme.colors.surface1,
          borderWidth: componentMetrics.borderWidth.hairline,
          borderColor: isPending ? theme.colors.warningBorder : theme.colors.border,
          shadowColor: componentMetrics.shadow.black,
          shadowOpacity: componentMetrics.transactionRow.shadowOpacity,
          shadowRadius: componentMetrics.transactionRow.shadowRadius,
          shadowOffset: { width: 0, height: componentMetrics.transactionRow.shadowOffsetY },
          elevation: 1,
        },
        isExcluded && { opacity: componentMetrics.transactionRow.excludedOpacity },
      ]}
    >
      <Text
        style={{
          fontSize: componentMetrics.transactionRow.iconFontSize,
          width: componentMetrics.transactionRow.iconWidth,
          textAlign: 'center',
        }}
      >
        {icon}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: componentMetrics.transactionRow.nameFontSize,
            fontWeight: String(theme.typography.weight.semibold) as TextStyle['fontWeight'],
            lineHeight: componentMetrics.transactionRow.nameLineHeight,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.size.sm,
            color:
              metaTone === 'warn' ? theme.colors.palette.amber['700'] : theme.colors.textSecondary,
            fontWeight:
              metaTone === 'warn'
                ? (String(theme.typography.weight.semibold) as TextStyle['fontWeight'])
                : undefined,
            marginTop: componentMetrics.transactionRow.metaMarginTop,
          }}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={{
          fontSize: theme.typography.size.md,
          fontWeight: String(theme.typography.weight.bold) as TextStyle['fontWeight'],
          color: direction === 'in' ? theme.colors.success : theme.colors.brandSecondary,
        }}
      >
        {amount}
      </Text>
    </Pressable>
  );
}

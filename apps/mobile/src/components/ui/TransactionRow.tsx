import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
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

  const rowStyle = [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.space['3'],
      width: '100%' as const,
      padding: theme.space['3'],
      paddingHorizontal: theme.space['4'],
      borderRadius: theme.radius.lg,
      backgroundColor: isPending ? theme.colors.warningBg : theme.colors.surface1,
      borderWidth: componentMetrics.borderWidth.hairline,
      borderColor: isPending ? theme.colors.warningBorder : theme.colors.border,
      shadowColor: componentMetrics.shadow.black,
      shadowOpacity: componentMetrics.shadow.sm.opacity,
      shadowRadius: componentMetrics.shadow.sm.radius,
      shadowOffset: { width: 0, height: componentMetrics.shadow.sm.offsetY },
      elevation: componentMetrics.shadow.sm.elevation,
    },
    isExcluded && { opacity: componentMetrics.transactionRow.excludedOpacity },
  ];

  const content = (
    <>
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
            fontWeight: fontWeight(theme.typography.weight.semibold),
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
              metaTone === 'warn' ? fontWeight(theme.typography.weight.semibold) : undefined,
            marginTop: componentMetrics.transactionRow.metaMarginTop,
          }}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={{
          fontSize: theme.typography.size.md,
          fontWeight: fontWeight(theme.typography.weight.bold),
          color: direction === 'in' ? theme.colors.success : theme.colors.brandSecondary,
        }}
      >
        {amount}
      </Text>
    </>
  );

  // A row with no `onPress` is not actionable — rendering it as a Pressable with
  // accessibilityRole="button" would announce a "button" to screen readers that does nothing
  // on activation (found in review). Fall back to a plain View, matching how Checkbox/Radio/
  // Switch handle an omitted handler (Decision 4).
  if (onPress === undefined) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}, ${amount}`}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}

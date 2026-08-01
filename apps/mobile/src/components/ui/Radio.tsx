import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';

export type RadioProps = {
  selected: boolean;
  /** Omit when this radio is rendered inside a pressable row that owns the press — see the
   * implementation plan's Decision 4. */
  onPress?: () => void;
  accessibilityLabel: string;
};

/** `.mu-radio`, `.is-on`, `::after`. */
export function Radio({ selected, onPress, accessibilityLabel }: RadioProps) {
  const ringStyle = {
    width: componentMetrics.radio.size,
    height: componentMetrics.radio.size,
    borderRadius: theme.radius.pill,
    borderWidth: componentMetrics.radio.borderWidth,
    borderColor: selected ? theme.colors.brandPrimary : theme.colors.borderInput,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  };

  const dot = selected ? (
    <View
      style={{
        width: componentMetrics.radio.dotSize,
        height: componentMetrics.radio.dotSize,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.brandPrimary,
      }}
    />
  ) : null;

  if (onPress === undefined) {
    return <View style={ringStyle}>{dot}</View>;
  }

  const touchMetrics = TOUCH_METRICS.radio;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={touchMetrics?.hitSlop}
      style={ringStyle}
    >
      {dot}
    </Pressable>
  );
}

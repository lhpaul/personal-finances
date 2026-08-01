import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';

export type SwitchProps = {
  value: boolean;
  /** Omit when this switch is rendered inside a pressable row that owns the press — see the
   * implementation plan's Decision 4. */
  onValueChange?: (value: boolean) => void;
  accessibilityLabel: string;
};

/** `.mu-switch`, `.is-on`, `::after`. */
export function Switch({ value, onValueChange, accessibilityLabel }: SwitchProps) {
  const trackStyle = {
    width: componentMetrics.switchControl.width,
    height: componentMetrics.switchControl.height,
    borderRadius: theme.radius.pill,
    backgroundColor: value ? theme.colors.brandPrimary : theme.colors.switchTrackOff,
    flexShrink: 0,
    position: 'relative' as const,
  };

  const thumb = (
    <View
      style={{
        position: 'absolute',
        top: componentMetrics.switchControl.thumbInset,
        left: value
          ? componentMetrics.switchControl.thumbTranslateX + componentMetrics.switchControl.thumbInset
          : componentMetrics.switchControl.thumbInset,
        width: componentMetrics.switchControl.thumbSize,
        height: componentMetrics.switchControl.thumbSize,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface1,
        shadowColor: componentMetrics.shadow.black,
        shadowOpacity: componentMetrics.shadow.sm.opacity,
        shadowRadius: componentMetrics.shadow.sm.radius,
        shadowOffset: { width: 0, height: componentMetrics.shadow.sm.offsetY },
        elevation: 1,
      }}
    />
  );

  if (onValueChange === undefined) {
    return <View style={trackStyle}>{thumb}</View>;
  }

  const touchMetrics = TOUCH_METRICS.switch;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      hitSlop={touchMetrics?.hitSlop}
      style={trackStyle}
    >
      {thumb}
    </Pressable>
  );
}

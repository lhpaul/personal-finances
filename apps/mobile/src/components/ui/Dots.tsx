import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';

export type DotsProps = {
  total: number;
  /** 1-based. */
  current: number;
};

/** `.mu-dots`, `__dot`, `.is-on`. */
export function Dots({ total, current }: DotsProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{
        flexDirection: 'row',
        gap: componentMetrics.dots.gap,
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: total }, (_, index) => {
        const dotNumber = index + 1;
        const isOn = dotNumber === current;
        return (
          <View
            key={dotNumber}
            style={{
              width: isOn ? componentMetrics.dots.activeWidth : componentMetrics.dots.size,
              height: componentMetrics.dots.size,
              borderRadius: theme.radius.pill,
              backgroundColor: isOn ? theme.colors.brandPrimary : theme.colors.palette.slate['300'],
            }}
          />
        );
      })}
    </View>
  );
}

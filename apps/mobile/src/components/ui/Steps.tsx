import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';

export type StepsProps = {
  total: number;
  /** 1-based. */
  current: number;
};

/** `.mu-steps`, `__step`, `.is-on`. */
export function Steps({ total, current }: StepsProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={{ flexDirection: 'row', gap: componentMetrics.steps.gap }}
    >
      {Array.from({ length: total }, (_, index) => {
        const stepNumber = index + 1;
        const isOn = stepNumber <= current;
        return (
          <View
            key={stepNumber}
            style={{
              flex: 1,
              height: componentMetrics.steps.height,
              borderRadius: theme.radius.pill,
              backgroundColor: isOn ? theme.colors.brandPrimary : theme.colors.surface3,
            }}
          />
        );
      })}
    </View>
  );
}

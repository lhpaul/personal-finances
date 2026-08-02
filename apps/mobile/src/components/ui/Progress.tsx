import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';

export type ProgressProps = {
  /** 0–1. */
  value: number;
  accessibilityLabel: string;
};

/** `.mu-progress`, `__fill`. */
export function Progress({ value, accessibilityLabel }: ProgressProps) {
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: componentMetrics.progress.height,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface3,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${clamped * 100}%`,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.brandPrimary,
        }}
      />
    </View>
  );
}

import { Pressable } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type PillProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

/** `.mu-pill`, `.is-active`. */
export function Pill({ label, active = false, onPress }: PillProps) {
  const touchMetrics = TOUCH_METRICS.pill;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={{
        paddingVertical: componentMetrics.pill.paddingVertical,
        paddingHorizontal: componentMetrics.pill.paddingHorizontal,
        borderRadius: theme.radius.pill,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: active ? theme.colors.brandPrimary : theme.colors.border,
        backgroundColor: active ? theme.colors.brandPrimary : theme.colors.surface1,
      }}
    >
      <Text
        variant="small"
        tone={active ? 'inverse' : 'secondary'}
        style={{ fontWeight: fontWeight(theme.typography.weight.semibold) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

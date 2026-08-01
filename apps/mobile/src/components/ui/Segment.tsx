import { Pressable, View, type TextStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type SegmentOption = {
  value: string;
  label: string;
};

export type SegmentProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
};

/** `.mu-segment`, `__item`, `.is-active`. */
export function Segment({ options, value, onChange }: SegmentProps) {
  const touchMetrics = TOUCH_METRICS.segmentItem;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        padding: componentMetrics.segment.padding,
        gap: componentMetrics.segment.gap,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface3,
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            hitSlop={touchMetrics?.hitSlop}
            style={[
              {
                paddingVertical: componentMetrics.segment.itemPaddingVertical,
                paddingHorizontal: componentMetrics.segment.itemPaddingHorizontal,
                borderRadius: theme.radius.pill,
              },
              isActive && {
                backgroundColor: theme.colors.surface1,
                shadowColor: componentMetrics.shadow.black,
                shadowOpacity: componentMetrics.shadow.sm.opacity,
                shadowRadius: componentMetrics.shadow.sm.radius,
                shadowOffset: { width: 0, height: componentMetrics.shadow.sm.offsetY },
                elevation: 1,
              },
            ]}
          >
            <Text
              variant="small"
              tone={isActive ? 'primary' : 'secondary'}
              style={{ fontWeight: String(theme.typography.weight.semibold) as TextStyle['fontWeight'] }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

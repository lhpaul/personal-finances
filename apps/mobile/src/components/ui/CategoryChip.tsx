import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

/** Decorative glyph, not user-facing copy: it is language-independent and must not enter the
 *  i18n catalogues. Named so `i18next/no-literal-string` sees an expression, not JSX text
 *  (implementation plan Decision 10). */
const STAR_GLYPH = '★';

export type CategoryChipState = 'default' | 'selected' | 'suggested';

export type CategoryChipProps = {
  emoji: string;
  label: string;
  hint?: string;
  state?: CategoryChipState;
  onPress?: (event: GestureResponderEvent) => void;
};

/** `.mu-chip`, `__emoji`, `__hint`, `__star`, `.is-selected`, `.is-suggested`. */
export function CategoryChip({
  emoji,
  label,
  hint,
  state = 'default',
  onPress,
}: CategoryChipProps) {
  const touchMetrics = TOUCH_METRICS.categoryChip;
  const isActive = state === 'selected' || state === 'suggested';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === 'selected' }}
      onPress={onPress}
      hitSlop={touchMetrics.hitSlop}
      style={{
        minHeight: componentMetrics.categoryChip.minHeight,
        paddingVertical: theme.space['3'],
        paddingHorizontal: theme.space['2'],
        borderRadius: theme.radius.lg,
        backgroundColor: state === 'selected' ? theme.colors.infoBg : theme.colors.surface1,
        borderWidth: componentMetrics.borderWidth.control,
        borderColor: isActive ? theme.colors.brandPrimary : theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: componentMetrics.categoryChip.gap,
        position: 'relative',
      }}
    >
      <Text
        style={{
          fontSize: componentMetrics.categoryChip.emojiSize,
          lineHeight: componentMetrics.categoryChip.emojiLineHeight,
        }}
      >
        {emoji}
      </Text>
      <Text
        variant="small"
        tone="primary"
        center
        style={{ fontWeight: fontWeight(theme.typography.weight.semibold) }}
      >
        {label}
      </Text>
      {hint !== undefined && (
        <Text
          variant="xs"
          tone="tertiary"
          center
          style={{ fontWeight: fontWeight(theme.typography.weight.medium) }}
        >
          {hint}
        </Text>
      )}
      {state === 'suggested' && (
        <View
          style={{
            position: 'absolute',
            top: componentMetrics.categoryChip.starOffset,
            right: componentMetrics.categoryChip.starOffset,
            width: componentMetrics.categoryChip.starSize,
            height: componentMetrics.categoryChip.starSize,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.brandPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            tone="inverse"
            style={{ fontSize: componentMetrics.categoryChip.starFontSize }}
          >
            {STAR_GLYPH}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

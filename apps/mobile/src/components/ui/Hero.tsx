import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent, type TextStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type HeroGradient = 'challenge' | 'income' | 'expense' | 'celebration' | 'brand';

export type HeroProps = {
  gradient?: HeroGradient;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress?: (event: GestureResponderEvent) => void;
};

/**
 * `.mu-hero`, `__row`, `__icon`, `__title`, `__sub`, `::after`.
 *
 * **Known limitation**: the mockup background is a CSS `linear-gradient`
 * (`theme.gradients.<name>`, `angle`/`from`/`to`). This item adds no new runtime dependency
 * (the plan's Infrastructure section rules out `expo-linear-gradient`), so the visual box uses
 * a flat `theme.gradients.<name>.from` fill instead of a true gradient. Wiring a real gradient
 * renderer is out of this item's scope.
 */
export function Hero({ gradient = 'challenge', icon, title, subtitle, onPress }: HeroProps) {
  const touchMetrics = TOUCH_METRICS.hero;
  const content = (
    <View
      style={{
        borderRadius: theme.radius.card,
        padding: theme.space['5'],
        backgroundColor: theme.gradients[gradient].from,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: componentMetrics.hero.decorationOffset,
          top: componentMetrics.hero.decorationOffset,
          width: componentMetrics.hero.decorationSize,
          height: componentMetrics.hero.decorationSize,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.onGradientDecoration,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['4'] }}>
        <View
          style={{
            width: componentMetrics.hero.iconSize,
            height: componentMetrics.hero.iconSize,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.onGradientSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text tone="inverse" style={{ fontSize: componentMetrics.hero.iconGlyphSize }}>
            {icon}
          </Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text
            tone="inverse"
            style={{
              fontSize: theme.typography.size.lg,
              fontWeight: String(theme.typography.weight.extrabold) as TextStyle['fontWeight'],
              letterSpacing: componentMetrics.hero.titleLetterSpacing,
            }}
          >
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text
              tone="inverse"
              style={{
                fontSize: theme.typography.size.base,
                opacity: 0.9,
                marginTop: componentMetrics.hero.subMarginTop,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  if (onPress === undefined) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      hitSlop={touchMetrics?.hitSlop}
    >
      {content}
    </Pressable>
  );
}

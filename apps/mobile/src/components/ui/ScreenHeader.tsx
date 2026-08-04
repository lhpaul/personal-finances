import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type ScreenHeaderVariant = 'default' | 'plain';

export type ScreenHeaderAction = {
  icon: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  /** `brand` renders `.mu-head__action--brand` — filled brand background, white icon — instead
   * of the default `surface3` fill (implementation plan for issue #15, Decision 11; first drawn
   * by `#screen=transactions`'s ⚙ action). */
  variant?: 'default' | 'brand';
  /** `.mu-head__action--dot` — a small badge in the action's top-right corner (implementation
   * plan for issue #15, Decision 11), e.g. "a filter differs from the default." */
  dot?: boolean;
};

export type ScreenHeaderProps = {
  avatar: ReactNode;
  /** `default` renders the avatar on `theme.colors.infoBg`; `brand` renders it on
   * `theme.gradients.brand.from` (`.mu-head__avatar--brand`). */
  avatarTone?: 'default' | 'brand';
  title: string;
  subtitle?: string;
  /** `plain` drops the surface fill and the bottom border (`.mu-head--plain`). */
  variant?: ScreenHeaderVariant;
  action?: ScreenHeaderAction;
};

/**
 * `.mu-head`, `--plain`, `__avatar`, `__avatar--brand`, `__txt`, `__title`, `__sub`, `__action`
 * (home-screen implementation plan for issue #12, Decision 5).
 *
 * Renders no top safe-area padding of its own — the mockup's bare `52px` top padding simulates
 * a status bar inside its own browser chrome; the app instead wraps the route in
 * `SafeAreaView({ edges: ['top'] })` (item #8's pattern), and this component supplies only the
 * padding below that inset.
 */
export function ScreenHeader({
  avatar,
  avatarTone = 'default',
  title,
  subtitle,
  variant = 'default',
  action,
}: ScreenHeaderProps) {
  const touchMetrics = TOUCH_METRICS.headerAction;

  return (
    <View
      style={[
        {
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.space['3'],
          paddingHorizontal: theme.space['5'],
          paddingVertical: componentMetrics.screenHeader.paddingVertical,
        },
        variant === 'default'
          ? {
              backgroundColor: theme.colors.surface1,
              borderBottomWidth: componentMetrics.borderWidth.hairline,
              borderBottomColor: theme.colors.border,
            }
          : { backgroundColor: 'transparent' },
      ]}
    >
      <View
        style={{
          width: componentMetrics.screenHeader.avatarSize,
          height: componentMetrics.screenHeader.avatarSize,
          borderRadius: theme.radius.lg,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            avatarTone === 'brand' ? theme.gradients.brand.from : theme.colors.infoBg,
        }}
      >
        <Text style={{ fontSize: componentMetrics.screenHeader.avatarGlyphSize }}>{avatar}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: theme.typography.size.xl,
            fontWeight: fontWeight(theme.typography.weight.extrabold),
            letterSpacing: componentMetrics.screenHeader.titleLetterSpacing,
            lineHeight: componentMetrics.screenHeader.titleLineHeight,
          }}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text
            variant="body"
            tone="secondary"
            style={{ marginTop: componentMetrics.screenHeader.subMarginTop }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          hitSlop={touchMetrics.hitSlop}
          style={{
            width: componentMetrics.screenHeader.actionSize,
            height: componentMetrics.screenHeader.actionSize,
            borderRadius: theme.radius.md,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              action.variant === 'brand' ? theme.colors.brandPrimary : theme.colors.surface3,
          }}
        >
          <Text
            style={[
              { fontSize: componentMetrics.screenHeader.actionGlyphFontSize },
              action.variant === 'brand' && { color: theme.colors.textOnBrand },
            ]}
          >
            {action.icon}
          </Text>
          {action.dot === true && (
            <View
              style={{
                position: 'absolute',
                top: componentMetrics.screenHeader.actionDotOffset,
                right: componentMetrics.screenHeader.actionDotOffset,
                width: componentMetrics.screenHeader.actionDotSize,
                height: componentMetrics.screenHeader.actionDotSize,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.danger,
                borderWidth: componentMetrics.borderWidth.control,
                borderColor: theme.colors.surface1,
              }}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}

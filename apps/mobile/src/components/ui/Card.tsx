import type { ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

/**
 * `'flat-tight'` (dashboard implementation plan for issue #17, Decision 8) is `--flat` and
 * `--tight` composed together — the mockup's two mini stat tiles
 * (`.mu-card.mu-card--flat.mu-card--tight`) are the first call site to need both at once.
 * Additive: every existing call site passes one of the other three values and is unaffected.
 */
export type CardVariant = 'default' | 'tight' | 'flat' | 'flat-tight';

export type CardProps = {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children?: ReactNode;
};

const TIGHT_VARIANTS = new Set<CardVariant>(['tight', 'flat-tight']);
const FLAT_VARIANTS = new Set<CardVariant>(['flat', 'flat-tight']);

/** `.mu-card` + `--tight` `--flat`, `__title`, `__sub`, `__head`. */
export function Card({ variant = 'default', title, subtitle, headerRight, children }: CardProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || headerRight !== undefined;
  const isFlat = FLAT_VARIANTS.has(variant);

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface1,
          borderRadius: theme.radius.card,
          padding: TIGHT_VARIANTS.has(variant) ? theme.space['4'] : theme.space['5'],
          borderWidth: componentMetrics.borderWidth.hairline,
          borderColor: theme.colors.border,
        },
        isFlat
          ? { backgroundColor: theme.colors.surface2 }
          : {
              shadowColor: theme.colors.textPrimary,
              shadowOpacity: componentMetrics.shadow.card.opacity,
              shadowRadius: componentMetrics.shadow.card.radius,
              shadowOffset: { width: 0, height: componentMetrics.shadow.card.offsetY },
              elevation: componentMetrics.shadow.card.elevation,
            },
      ]}
    >
      {hasHeader && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space['3'],
            marginBottom: theme.space['4'],
          }}
        >
          <View style={{ flexShrink: 1 }}>
            {title !== undefined && (
              <Text
                variant="h3"
                style={{ letterSpacing: componentMetrics.card.titleLetterSpacing }}
              >
                {title}
              </Text>
            )}
            {subtitle !== undefined && (
              <Text
                variant="small"
                style={{ marginTop: componentMetrics.card.subMarginTop }}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight}
        </View>
      )}
      {children}
    </View>
  );
}

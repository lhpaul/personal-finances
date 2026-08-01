import type { ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type CardVariant = 'default' | 'tight' | 'flat';

export type CardProps = {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children?: ReactNode;
};

/** `.mu-card` + `--tight` `--flat`, `__title`, `__sub`, `__head`. */
export function Card({ variant = 'default', title, subtitle, headerRight, children }: CardProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || headerRight !== undefined;

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface1,
          borderRadius: theme.radius.card,
          padding: variant === 'tight' ? theme.space['4'] : theme.space['5'],
          borderWidth: componentMetrics.borderWidth.hairline,
          borderColor: theme.colors.border,
        },
        variant === 'flat'
          ? { backgroundColor: theme.colors.surface2 }
          : {
              shadowColor: theme.colors.textPrimary,
              shadowOpacity: componentMetrics.card.shadowOpacity,
              shadowRadius: componentMetrics.card.shadowRadius,
              shadowOffset: { width: 0, height: componentMetrics.card.shadowOffsetY },
              elevation: 1,
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

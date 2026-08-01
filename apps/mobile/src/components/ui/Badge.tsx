import { View, type TextStyle, type ViewStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'celebration';

export type BadgeProps = {
  tone?: BadgeTone;
  label: string;
};

const TONE_STYLE: Record<BadgeTone, { background: string; border: string; color: string }> = {
  neutral: {
    background: theme.colors.surface3,
    border: theme.colors.border,
    color: theme.colors.textSecondary,
  },
  ok: {
    background: theme.colors.successBg,
    border: theme.colors.successBorder,
    color: theme.colors.palette.emerald['700'],
  },
  warn: {
    background: theme.colors.warningBg,
    border: theme.colors.warningBorder,
    color: theme.colors.palette.amber['700'],
  },
  danger: {
    background: theme.colors.dangerBg,
    border: theme.colors.dangerBorder,
    color: theme.colors.palette.red['700'],
  },
  info: {
    background: theme.colors.infoBg,
    border: theme.colors.infoBorder,
    color: theme.colors.brandPrimaryDarker,
  },
  celebration: {
    background: theme.colors.celebrationBg,
    border: theme.colors.celebrationBorder,
    color: theme.colors.palette.violet['700'],
  },
};

/** `.mu-badge` + `--ok` `--warn` `--danger` `--info` `--celebration`. */
export function Badge({ tone = 'neutral', label }: BadgeProps) {
  const toneStyle = TONE_STYLE[tone];

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: componentMetrics.badge.gap,
    paddingVertical: componentMetrics.badge.paddingVertical,
    paddingHorizontal: componentMetrics.badge.paddingHorizontal,
    borderRadius: theme.radius.pill,
    backgroundColor: toneStyle.background,
    borderWidth: componentMetrics.borderWidth.hairline,
    borderColor: toneStyle.border,
    alignSelf: 'flex-start',
  };

  return (
    <View style={containerStyle}>
      <Text
        variant="xs"
        style={{
          color: toneStyle.color,
          fontWeight: String(theme.typography.weight.bold) as TextStyle['fontWeight'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

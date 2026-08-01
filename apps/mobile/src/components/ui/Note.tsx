import type { ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type NoteTone = 'info' | 'ok' | 'warn' | 'danger';

export type NoteProps = {
  tone?: NoteTone;
  icon: ReactNode;
  children: ReactNode;
};

const TONE_STYLE: Record<NoteTone, { background: string; border: string }> = {
  info: { background: theme.colors.infoBg, border: theme.colors.infoBorder },
  ok: { background: theme.colors.successBg, border: theme.colors.successBorder },
  warn: { background: theme.colors.warningBg, border: theme.colors.warningBorder },
  danger: { background: theme.colors.dangerBg, border: theme.colors.dangerBorder },
};

/** `.mu-note`, `--ok`, `--warn`, `--danger`, `__icon`. */
export function Note({ tone = 'info', icon, children }: NoteProps) {
  const toneStyle = TONE_STYLE[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space['3'],
        padding: theme.space['4'],
        borderRadius: theme.radius.lg,
        backgroundColor: toneStyle.background,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: toneStyle.border,
      }}
    >
      <Text
        style={{
          fontSize: componentMetrics.note.iconFontSize,
          lineHeight: componentMetrics.note.iconLineHeight,
        }}
      >
        {icon}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: theme.typography.size.sm,
            color: theme.colors.palette.slate['700'],
            lineHeight: componentMetrics.note.lineHeight,
          }}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

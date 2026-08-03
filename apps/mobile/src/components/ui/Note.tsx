import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type NoteTone = 'info' | 'ok' | 'warn' | 'danger';

export type NoteAction = {
  label: string;
  onPress: () => void;
};

export type NoteProps = {
  tone?: NoteTone;
  icon: ReactNode;
  children: ReactNode;
  /** An optional call-to-action rendered as its own sibling `Pressable` below the note text —
   * never nested inside the text's single `Text` element (found in review, home-screen
   * implementation plan for issue #12). Nesting a pressable `Text` inside another `Text` is not
   * reliably focusable by assistive tech and has no minimum touch target; a sibling `Pressable`
   * with `TOUCH_METRICS.noteAction` gives it both. */
  action?: NoteAction;
};

const TONE_STYLE: Record<NoteTone, { background: string; border: string }> = {
  info: { background: theme.colors.infoBg, border: theme.colors.infoBorder },
  ok: { background: theme.colors.successBg, border: theme.colors.successBorder },
  warn: { background: theme.colors.warningBg, border: theme.colors.warningBorder },
  danger: { background: theme.colors.dangerBg, border: theme.colors.dangerBorder },
};

/** `.mu-note`, `--ok`, `--warn`, `--danger`, `__icon`. */
export function Note({ tone = 'info', icon, children, action }: NoteProps) {
  const toneStyle = TONE_STYLE[tone];
  const touchMetrics = TOUCH_METRICS.noteAction;

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
        {action !== undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={touchMetrics.hitSlop}
            style={{ alignSelf: 'flex-start', marginTop: componentMetrics.note.actionMarginTop }}
          >
            <Text
              style={{
                fontSize: theme.typography.size.sm,
                color: theme.colors.brandPrimary,
                fontWeight: fontWeight(theme.typography.weight.bold),
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

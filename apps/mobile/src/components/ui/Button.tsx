import {
  Pressable,
  Text as RNText,
  type GestureResponderEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';

export type ButtonVariant = 'primary' | 'muted' | 'outline' | 'ghost' | 'danger' | 'dangerSoft';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `.mu-btn` is `width: 100%` by default; `.mu-btn--sm` / `.mu-btn--auto` are `width: auto`.
   * Defaults to `true` for `size: 'md'` and `false` for `size: 'sm'`. */
  fullWidth?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
};

const VARIANT_STYLE: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: theme.colors.brandPrimary },
  muted: { backgroundColor: theme.colors.palette.indigo['300'] },
  outline: {
    backgroundColor: theme.colors.surface1,
    borderWidth: componentMetrics.borderWidth.hairline,
    borderColor: theme.colors.borderInput,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: theme.colors.danger },
  dangerSoft: {
    backgroundColor: theme.colors.dangerBg,
    borderWidth: componentMetrics.borderWidth.hairline,
    borderColor: theme.colors.dangerBorder,
  },
};

const VARIANT_TEXT_COLOR: Record<ButtonVariant, string> = {
  primary: theme.colors.textOnBrand,
  muted: theme.colors.textOnBrand,
  outline: theme.colors.textPrimary,
  ghost: theme.colors.textSecondary,
  danger: theme.colors.textOnBrand,
  dangerSoft: theme.colors.danger,
};

/**
 * `.mu-btn` — primary / muted / outline / ghost / danger / danger-soft, `size="sm"`.
 *
 * Presentational and copy-free: `label` is the only text, passed in by the caller
 * (Decision 3).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = size === 'md',
  label,
  onPress,
  disabled = false,
}: ButtonProps) {
  const touchMetrics = size === 'sm' ? TOUCH_METRICS.buttonSm : TOUCH_METRICS.button;
  const height =
    size === 'sm'
      ? componentMetrics.button.heightSm
      : variant === 'ghost'
        ? componentMetrics.button.heightGhost
        : componentMetrics.button.height;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={touchMetrics?.hitSlop}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space['2'],
          minHeight: height,
          paddingHorizontal: size === 'sm' ? theme.space['4'] : theme.space['5'],
          width: fullWidth ? '100%' : 'auto',
          borderRadius: theme.radius.button,
        },
        VARIANT_STYLE[variant],
        disabled && { opacity: 0.55 },
      ]}
    >
      <RNText
        style={{
          // `.mu-btn--sm` (L360) overrides font-size to `var(--base)` (14); the default
          // `.mu-btn` (L351) literal 15 applies to every other size.
          fontSize: size === 'sm' ? theme.typography.size.base : componentMetrics.button.fontSize,
          fontWeight: String(theme.typography.weight.semibold) as TextStyle['fontWeight'],
          letterSpacing: componentMetrics.button.letterSpacing,
          color: VARIANT_TEXT_COLOR[variant],
        }}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

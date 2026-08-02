import type { ReactNode } from 'react';
import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyLead'
  | 'small'
  | 'xs'
  | 'eyebrow'
  | 'label'
  | 'hint'
  | 'mono';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'inverse' | 'danger';

export type TextProps = Omit<RNTextProps, 'style'> & {
  /** Which mockup typography helper this maps to (`.mu-h1`…`.mu-xs`, `.mu-eyebrow`,
   * `.mu-label`, `.mu-hint`, `.mu-mono` — Decision 5). Defaults to `'body'` (`.mu-p`). */
  variant?: TextVariant;
  /** Overrides the variant's default color. `hint` + `danger` also picks up `.mu-hint--error`'s
   * bold weight. */
  tone?: TextTone;
  /** `.mu-center` — centers the text. */
  center?: boolean;
  /** Escape hatch for a consuming primitive to layer a `theme` / `componentMetrics`-sourced
   * override (e.g. `Card`'s title letter-spacing). Never pass a raw literal here — the same
   * `no-style-literals` scan that covers every other file also covers this prop's call sites. */
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

const TONE_COLOR: Record<TextTone, string> = {
  primary: theme.colors.textPrimary,
  secondary: theme.colors.textSecondary,
  tertiary: theme.colors.textTertiary,
  brand: theme.colors.textBrand,
  inverse: theme.colors.textOnBrand,
  danger: theme.colors.danger,
};

const VARIANT_DEFAULT_TONE: Record<TextVariant, TextTone> = {
  h1: 'primary',
  h2: 'primary',
  h3: 'primary',
  body: 'secondary',
  bodyLead: 'secondary',
  small: 'secondary',
  xs: 'tertiary',
  eyebrow: 'brand',
  label: 'secondary',
  hint: 'secondary',
  mono: 'primary',
};

/** Base style per variant (`.mu-h1`…`.mu-xs`, `.mu-eyebrow`, `.mu-label`, `.mu-hint`, `.mu-mono`).
 * Color is applied separately from `tone`, not baked in here. */
function variantStyle(variant: TextVariant): TextStyle {
  switch (variant) {
    case 'h1':
      return {
        fontSize: theme.typography.size['2xl'],
        fontWeight: fontWeight(theme.typography.weight.extrabold),
        letterSpacing: componentMetrics.text.h1.letterSpacing,
        lineHeight: componentMetrics.text.h1.lineHeight,
      };
    case 'h2':
      return {
        fontSize: theme.typography.size.lg,
        fontWeight: fontWeight(theme.typography.weight.bold),
        letterSpacing: componentMetrics.text.h2.letterSpacing,
        lineHeight: componentMetrics.text.h2.lineHeight,
      };
    case 'h3':
      return {
        fontSize: theme.typography.size.md,
        fontWeight: fontWeight(theme.typography.weight.bold),
        letterSpacing: componentMetrics.text.h3.letterSpacing,
      };
    case 'body':
      return {
        fontSize: theme.typography.size.base,
        lineHeight: componentMetrics.text.body.lineHeight,
      };
    case 'bodyLead':
      return {
        fontSize: componentMetrics.text.bodyLead.fontSize,
        lineHeight: componentMetrics.text.bodyLead.lineHeight,
      };
    case 'small':
      return { fontSize: theme.typography.size.sm };
    case 'xs':
      return { fontSize: theme.typography.size.xs };
    case 'eyebrow':
      return {
        fontSize: theme.typography.size.xs,
        fontWeight: fontWeight(theme.typography.weight.bold),
        letterSpacing: componentMetrics.text.eyebrow.letterSpacing,
        textTransform: 'uppercase',
      };
    case 'label':
      return {
        fontSize: theme.typography.size.sm,
        fontWeight: fontWeight(theme.typography.weight.semibold),
        marginBottom: componentMetrics.text.label.marginBottom,
      };
    case 'hint':
      return {
        fontSize: theme.typography.size.sm,
        marginTop: componentMetrics.text.hint.marginTop,
      };
    case 'mono':
      return {
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: theme.typography.size.sm,
        letterSpacing: componentMetrics.text.mono.letterSpacing,
      };
  }
}

/**
 * Typography primitive mirroring the mockup's text helpers (`.mu-h1`…`.mu-xs`, `.mu-eyebrow`,
 * `.mu-label`, `.mu-hint`, `.mu-hint--error`, `.mu-mono`, `.mu-center`).
 *
 * Presentational and copy-free — all text comes in as `children` (Decision 3).
 */
export function Text({ variant = 'body', tone, center = false, style, ...rest }: TextProps) {
  const resolvedTone = tone ?? VARIANT_DEFAULT_TONE[variant];
  const isErrorHint = variant === 'hint' && resolvedTone === 'danger';

  return (
    <RNText
      {...rest}
      style={[
        variantStyle(variant),
        { color: TONE_COLOR[resolvedTone] },
        isErrorHint && {
          fontWeight: fontWeight(theme.typography.weight.semibold),
        },
        center && { textAlign: 'center' as const },
        style,
      ]}
    />
  );
}

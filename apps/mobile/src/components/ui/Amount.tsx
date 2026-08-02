import { Text as RNText } from 'react-native';

import { fontWeight } from './_internal/font-weight';
import { theme } from '../../theme';

export type AmountTone = 'neutral' | 'in' | 'out';
export type AmountSize = 'hero' | 'lg' | 'md';

type AmountBase = { tone?: AmountTone; size?: AmountSize };

/**
 * `.mu-amount`, `--in`, `--out`, `--hero`.
 *
 * **No CLP formatting arithmetic lives here.** Either pass an already-`formatted` string, or
 * pass `minorUnits` alongside a **required** `format` callback — there is no default
 * formatter, so a wrong-looking CLP string can never reach a screen from this component. See
 * the implementation plan's Decision 7 (the seam with `@finanzas/shared-utils`, item #4).
 */
export type AmountProps =
  | (AmountBase & { formatted: string; minorUnits?: never; format?: never })
  | (AmountBase & {
      /** CLP minor units (pesos). Never a float. */
      minorUnits: number;
      /** Injected formatter — `@finanzas/shared-utils` (#4) supplies the real one. */
      format: (minorUnits: number) => string;
      formatted?: never;
    });

const TONE_COLOR: Record<AmountTone, string> = {
  neutral: theme.colors.textPrimary,
  in: theme.colors.success,
  out: theme.colors.brandSecondary,
};

export function Amount(props: AmountProps) {
  const { tone = 'neutral', size = 'md' } = props;
  // Narrow on `minorUnits` (the required-together pair with `format`), not on `formatted`:
  // an untyped caller could spread an object with `formatted: undefined`, which would fall
  // into the `formatted` branch below and read `undefined` as the text instead of calling
  // the injected formatter.
  const text =
    'minorUnits' in props && props.minorUnits !== undefined && props.format !== undefined
      ? props.format(props.minorUnits)
      : props.formatted;
  const scale = theme.typography.scale.amount[size];

  return (
    <RNText
      style={{
        fontVariant: ['tabular-nums'],
        fontSize: scale.fontSize,
        lineHeight: scale.lineHeight,
        fontWeight: fontWeight(scale.fontWeight),
        letterSpacing: 'letterSpacing' in scale ? scale.letterSpacing : undefined,
        color: TONE_COLOR[tone],
      }}
    >
      {text}
    </RNText>
  );
}

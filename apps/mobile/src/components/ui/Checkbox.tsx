import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

/** Decorative glyph, not user-facing copy: it is language-independent and must not enter the
 *  i18n catalogues. Named so `i18next/no-literal-string` sees an expression, not JSX text
 *  (implementation plan Decision 10). */
const CHECK_GLYPH = '✓';

export type CheckboxProps = {
  checked: boolean;
  /** Omit when this checkbox is rendered inside a pressable row that owns the press (e.g.
   * `.mu-item`) — see the implementation plan's Decision 4. When provided, this component
   * becomes pressable itself and applies its own `hitSlop`. */
  onChange?: (checked: boolean) => void;
  accessibilityLabel: string;
};

/** `.mu-check`, `.is-on`. */
export function Checkbox({ checked, onChange, accessibilityLabel }: CheckboxProps) {
  const boxStyle = {
    width: componentMetrics.checkbox.size,
    height: componentMetrics.checkbox.size,
    borderRadius: theme.radius.control,
    borderWidth: componentMetrics.borderWidth.control,
    borderColor: checked ? theme.colors.brandPrimary : theme.colors.borderInput,
    backgroundColor: checked ? theme.colors.brandPrimary : theme.colors.surface1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  };

  const glyph = checked ? (
    <Text
      tone="inverse"
      style={{ fontSize: componentMetrics.checkbox.checkGlyphFontSize }}
    >
      {CHECK_GLYPH}
    </Text>
  ) : null;

  if (onChange === undefined) {
    return <View style={boxStyle}>{glyph}</View>;
  }

  const touchMetrics = TOUCH_METRICS.checkbox;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={touchMetrics.hitSlop}
      style={boxStyle}
    >
      {glyph}
    </Pressable>
  );
}

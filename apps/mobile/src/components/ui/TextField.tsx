import type { ReactNode } from 'react';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

export type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** A non-null string renders `.mu-input.is-error` + `.mu-hint--error`. */
  error?: string | null;
  /** `.mu-input.is-locked` — read-only display mode. */
  locked?: boolean;
  secureTextEntry?: boolean;
  /** Leading slot (implementation plan for issue #9, Decision 16) — mirrors the mockup's search
   * input's magnifier. Additive: every existing call site renders unchanged without it. */
  icon?: ReactNode;
  /** Overrides the accessible name React Native would otherwise derive from `placeholder` (issue
   * #9, Decision 16) — a labelless search field would otherwise be announced as its emoji
   * placeholder. */
  accessibilityLabel?: string;
};

/** `.mu-field`, `.mu-label`, `.mu-input`, `--ph`, `.is-focus`, `.is-error`, `.is-locked`,
 * `.mu-hint`, `.mu-hint--error`. Focus is tracked internally via `onFocus`/`onBlur`. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error = null,
  locked = false,
  secureTextEntry = false,
  icon,
  accessibilityLabel,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = error !== null && error !== undefined;

  return (
    <View style={{ marginTop: theme.space['4'] }}>
      {label !== undefined && <Text variant="label">{label}</Text>}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space['3'],
            minHeight: componentMetrics.textField.height,
            paddingHorizontal: theme.space['4'],
            borderRadius: theme.radius.button,
            backgroundColor: theme.colors.surface1,
            borderWidth: componentMetrics.borderWidth.control,
            borderColor: theme.colors.borderInput,
          },
          // Reviewed: the `shadow*` ring below is iOS-only (Android has no `boxShadow`
          // equivalent for RN's `shadow*` props, only `elevation`, which draws a drop shadow,
          // not a ring, and would look wrong here). `borderColor` changing to brandPrimary is
          // the focus indicator that survives on every platform; the ring is an iOS-only
          // enhancement layered on top, not the only signal.
          focused &&
            !hasError && {
              borderColor: theme.colors.brandPrimary,
              shadowColor: theme.colors.focusRing,
              shadowOpacity: 1,
              shadowRadius: componentMetrics.textField.focusRingWidth,
              shadowOffset: { width: 0, height: 0 },
            },
          hasError && { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
          locked && { backgroundColor: theme.colors.surface3 },
        ]}
      >
        {icon !== undefined && icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          editable={!locked}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // `label` renders as a sibling Text, which React Native does not associate with the
          // input on its own — set an explicit accessible name (falling back to the
          // placeholder, or the caller's own override) and surface the error/hint as the
          // accessibility hint (found in review; `accessibilityLabel` override added issue #9).
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          accessibilityHint={hasError ? (error ?? undefined) : hint}
          style={{
            flex: 1,
            fontSize: componentMetrics.textField.fontSize,
            color: locked ? theme.colors.textSecondary : theme.colors.textPrimary,
          }}
        />
      </View>
      {hint !== undefined && !hasError && <Text variant="hint">{hint}</Text>}
      {hasError && (
        <Text variant="hint" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

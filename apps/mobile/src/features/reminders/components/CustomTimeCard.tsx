import { TextInput, View } from 'react-native';
import { timeOfDayFromParts, wallClockParts, type WallClockParts } from '@finanzas/shared-utils';

import { Segment, Text } from '../../../components/ui';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

export type CustomTimeCardProps = {
  label: string;
  /** `"HH:mm"`, 24-hour, zero-padded — the canonical stored/selected value. */
  timeOfDay: string;
  onChange: (timeOfDay: string) => void;
  meridiemLabels: { am: string; pm: string };
};

const MAX_DIGIT_LENGTH = 2;

/** Digits only — a decimal point, a minus sign or a letter must never reach `Number(...)` below
 * (an empty result after stripping falls back to `0`, which `timeOfDayFromParts` then clamps up
 * to the documented minimum). */
function toSafeInt(text: string): number {
  const digitsOnly = text.replace(/[^0-9]/g, '');
  return digitsOnly.length > 0 ? Number(digitsOnly) : 0;
}

/**
 * The custom-time editor: two numeric boxes and an AM/PM segment (implementation plan for issue
 * #18, Decision 10) — a screen-local composition, not a native date picker. Fully controlled by
 * the canonical `"HH:mm"` prop: every keystroke round-trips through
 * `wallClockParts`/`timeOfDayFromParts`, so the clamping (hour 1-12, minute 0-59) those pure
 * functions already unit-test is what the person sees, not a second, undocumented clamp here.
 */
export function CustomTimeCard({ label, timeOfDay, onChange, meridiemLabels }: CustomTimeCardProps) {
  const parts = wallClockParts(timeOfDay);

  function updateParts(next: Partial<WallClockParts>): void {
    onChange(timeOfDayFromParts({ ...parts, ...next }));
  }

  const boxStyle = {
    width: screenMetrics.reminders.customTimeBoxSize,
    height: screenMetrics.reminders.customTimeBoxSize,
    borderRadius: theme.radius.md,
    borderWidth: componentMetrics.borderWidth.control,
    borderColor: theme.colors.borderInput,
    backgroundColor: theme.colors.surface1,
    textAlign: 'center' as const,
    fontSize: theme.typography.size.lg,
    color: theme.colors.textPrimary,
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderRadius: theme.radius.card,
        padding: theme.space['5'],
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: theme.colors.border,
      }}
    >
      <Text variant="label">{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space['2'],
        }}
      >
        <TextInput
          value={String(parts.hour12).padStart(2, '0')}
          onChangeText={(text) => updateParts({ hour12: toSafeInt(text) })}
          keyboardType="number-pad"
          maxLength={MAX_DIGIT_LENGTH}
          accessibilityLabel={label}
          style={boxStyle}
        />
        <Text variant="h2">:</Text>
        <TextInput
          value={String(parts.minute).padStart(2, '0')}
          onChangeText={(text) => updateParts({ minute: toSafeInt(text) })}
          keyboardType="number-pad"
          maxLength={MAX_DIGIT_LENGTH}
          accessibilityLabel={label}
          style={boxStyle}
        />
        <View style={{ marginLeft: theme.space['2'] }}>
          <Segment
            options={[
              { value: 'am', label: meridiemLabels.am },
              { value: 'pm', label: meridiemLabels.pm },
            ]}
            value={parts.meridiem}
            onChange={(value) => updateParts({ meridiem: value as WallClockParts['meridiem'] })}
          />
        </View>
      </View>
    </View>
  );
}

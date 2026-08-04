import { View } from 'react-native';
import { formatWallClockLabel } from '@finanzas/shared-utils';

import { CategoryChip } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import type { ReminderPreset } from '../presets';

/** Decorative glyph, not user-facing copy — language-independent, must not enter the catalogues
 * (implementation plan for issue #18, Decision 1's Assumption, mirroring item #8's Decision 11). */
const CUSTOM_GLYPH = '⚙️';

export type TimePresetGridProps = {
  presets: ReminderPreset[];
  /** `undefined` when the current selection is `'custom'` — no preset chip should show selected
   * while the custom-time card is what the person is editing (Decision 9). */
  selectedPresetId: string | undefined;
  onSelectPreset: (preset: ReminderPreset) => void;
  customLabel: string;
  customSelected: boolean;
  onSelectCustom: () => void;
};

/**
 * `.mu-grid-2` over `CategoryChip` (implementation plan for issue #18, Layer-by-Layer). React
 * Native has no CSS grid, so the two-column layout is a wrapped flex row with a fixed column
 * width (`screenMetrics.reminders.timeGridColumnWidth`), mirroring
 * `MerchantCategoryPickerCard`'s identical `.mu-grid-2` composition exactly.
 */
export function TimePresetGrid({
  presets,
  selectedPresetId,
  onSelectPreset,
  customLabel,
  customSelected,
  onSelectCustom,
}: TimePresetGridProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space['3'],
      }}
    >
      {presets.map((preset) => (
        <View key={preset.id} style={{ width: screenMetrics.reminders.timeGridColumnWidth }}>
          <CategoryChip
            emoji={preset.glyph}
            label={formatWallClockLabel(preset.timeOfDay)}
            state={selectedPresetId === preset.id ? 'selected' : 'default'}
            onPress={() => onSelectPreset(preset)}
          />
        </View>
      ))}
      <View style={{ width: screenMetrics.reminders.timeGridColumnWidth }}>
        <CategoryChip
          emoji={CUSTOM_GLYPH}
          label={customLabel}
          state={customSelected ? 'selected' : 'default'}
          onPress={onSelectCustom}
        />
      </View>
    </View>
  );
}

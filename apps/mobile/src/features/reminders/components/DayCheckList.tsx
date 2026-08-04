import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Checkbox, Text } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';
import type { IsoWeekday } from '../../../lib/notifications';

/** Every branch calls the translation function with a literal key (never a variable key),
 * mirroring `app/(onboarding)/ready.tsx`'s discipline (implementation plan for issue #18,
 * Decision 8's catalogue-key-scan implication) — this is what lets
 * `reminders-catalogue-keys.test.ts` verify every key against the catalogue. */
function dayLabel(t: ReturnType<typeof useTranslation>['t'], isoWeekday: IsoWeekday): string {
  switch (isoWeekday) {
    case 1:
      return t('reminders.day_1');
    case 2:
      return t('reminders.day_2');
    case 3:
      return t('reminders.day_3');
    case 4:
      return t('reminders.day_4');
    case 5:
      return t('reminders.day_5');
    case 6:
      return t('reminders.day_6');
    case 7:
      return t('reminders.day_7');
  }
}

const ALL_ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export type DayCheckListProps = {
  days: IsoWeekday[];
  onChange: (days: IsoWeekday[]) => void;
};

/**
 * `.mu-list` / `.mu-item` over `Checkbox` (implementation plan for issue #18, Layer-by-Layer) —
 * built directly over the `Checkbox` primitive rather than `ListRow` (Resolution R3): the mockup's
 * day row is `.mu-item` with a leading `.mu-check`, not `ListRow`'s icon-box-plus-chevron shape
 * (`index.html:1071-1079`). `MU_CLASS_MAP` is not touched — `mu-item`/`mu-list` stay owned by
 * `ListRow`/`ListGroup` for the mockup's *other* `.mu-item` shape; this is a screen-local
 * composition of the same class for a variant `ListRow` does not render, exactly the choice item
 * #8 made for classes it also composed locally (Decision 10's precedent).
 */
export function DayCheckList({ days, onChange }: DayCheckListProps) {
  const { t } = useTranslation();

  function toggle(isoWeekday: IsoWeekday, checked: boolean): void {
    const next = checked
      ? Array.from(new Set([...days, isoWeekday])).sort((a, b) => a - b)
      : days.filter((day) => day !== isoWeekday);
    onChange(next);
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderRadius: theme.radius.card,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      {ALL_ISO_WEEKDAYS.map((isoWeekday, index) => {
        const label = dayLabel(t, isoWeekday);
        const checked = days.includes(isoWeekday);
        return (
          <View key={isoWeekday}>
            {index > 0 && (
              <View
                style={{
                  borderTopWidth: componentMetrics.borderWidth.hairline,
                  borderTopColor: theme.colors.border,
                }}
              />
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space['3'],
                paddingVertical: theme.space['4'],
                paddingHorizontal: theme.space['5'],
              }}
            >
              <Checkbox
                checked={checked}
                onChange={(next) => toggle(isoWeekday, next)}
                accessibilityLabel={label}
              />
              <Text style={{ fontSize: componentMetrics.listRow.titleFontSize }}>{label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

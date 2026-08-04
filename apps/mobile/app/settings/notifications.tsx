import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { formatWallClockLabel } from '@finanzas/shared-utils';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Note, Radio, Switch, Text, TopBar } from '../../src/components/ui';
import { DayCheckList } from '../../src/features/reminders/components/DayCheckList';
import { CustomTimeCard } from '../../src/features/reminders/components/CustomTimeCard';
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_TIME } from '../../src/features/reminders/constants';
import { resolvePresetSelection, SETTINGS_TIME_PRESETS, type ReminderPreset } from '../../src/features/reminders/presets';
import { useNotificationPermission } from '../../src/features/reminders/use-notification-permission';
import { useReminderSettings } from '../../src/features/reminders/use-reminder-settings';
import { resolveSettingsState } from '../../src/features/reminders/view-state';
import { getNotificationsPort, type IsoWeekday } from '../../src/lib/notifications';
import { fidelityTestId, useFidelityPreview } from '../../src/lib/fidelity-preview';
import { componentMetrics, theme } from '../../src/theme';

/** Decorative glyph, not user-facing copy (implementation plan for issue #18, mirroring item #8's
 * Decision 11). */
const BLOCKED_GLYPH = '📵';
const ERROR_GLYPH = '⚠️';

/** Every branch calls the translation function with a literal key (never a variable/template
 * key), mirroring `app/(onboarding)/ready.tsx`'s discipline — this is what lets
 * `reminders-catalogue-keys.test.ts` verify every key against the catalogue and assert no dynamic
 * key is used.
 *
 * `t: TFunction` (not `ReturnType<typeof useTranslation>['t']`) — item #21 found that the
 * standalone-parameter-type form blows up TypeScript's generic resolution
 * (`TS2589: Type instantiation is excessively deep and possibly infinite`) once the flat
 * catalogue passes ~740 keys (AGENTS.md Troubleshooting). */
function presetLabel(t: TFunction, presetId: string): string {
  switch (presetId) {
    case 'morning':
      return t('settings_notifications.preset_morning');
    case 'afternoon':
      return t('settings_notifications.preset_afternoon');
    case 'evening':
      return t('settings_notifications.preset_evening');
    default:
      return '';
  }
}

/**
 * `#screen=settings-notifications` (`enabled`, `disabled` — implementation plan for issue #18,
 * Decision 8). Effective state is the conjunction of the stored intent and the live OS permission
 * (Decision 5) — the OS wins: a revoked permission always shows `disabled`, and re-granting it
 * restores the previously-stored schedule without asking the person to re-enter it.
 */
export default function SettingsNotifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, settings, save } = useReminderSettings();
  const { permission, request } = useNotificationPermission();
  const preview = useFidelityPreview();

  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(DEFAULT_REMINDER_TIME);
  const [days, setDays] = useState<IsoWeekday[]>(DEFAULT_REMINDER_DAYS as IsoWeekday[]);
  const [customEditingActive, setCustomEditingActive] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || initialized) return;
    setEnabled(settings.enabled);
    setTimeOfDay(settings.timeOfDay ?? DEFAULT_REMINDER_TIME);
    setDays((settings.days ?? DEFAULT_REMINDER_DAYS) as IsoWeekday[]);
    setInitialized(true);
  }, [status, settings, initialized]);

  const derivedState = resolveSettingsState(enabled, permission);
  const viewState = preview.active ? (preview.state ?? derivedState) : derivedState;
  const selection = resolvePresetSelection(timeOfDay, SETTINGS_TIME_PRESETS);
  const showCustomEditor = customEditingActive || selection.kind === 'custom';

  async function handleToggle(next: boolean): Promise<void> {
    if (next && permission === 'undetermined') {
      const result = await request();
      if (result !== 'granted') return;
    }
    setEnabled(next);
    await persist(next, timeOfDay, days);
  }

  function selectPreset(preset: ReminderPreset): void {
    setTimeOfDay(preset.timeOfDay);
    setCustomEditingActive(false);
  }

  async function persist(nextEnabled: boolean, nextTime: string, nextDays: IsoWeekday[]): Promise<void> {
    setSaveError(false);
    const result = await save({ enabled: nextEnabled, timeOfDay: nextTime, days: nextDays });
    if (result.status === 'error') setSaveError(true);
  }

  async function handleSave(): Promise<void> {
    await persist(enabled, timeOfDay, days);
  }

  async function handleOpenSettings(): Promise<void> {
    await getNotificationsPort().openSystemSettings();
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('settings-notifications')}
    >
      <TopBar
        title={t('settings_notifications.title')}
        onBack={() => router.back()}
        backAccessibilityLabel={t('settings_notifications.title')}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.space['5'] }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: componentMetrics.listRow.titleFontSize }}>
              {t('settings_notifications.toggle_label')}
            </Text>
            <Switch
              value={viewState === 'enabled'}
              onValueChange={permission === 'denied' ? undefined : (next) => void handleToggle(next)}
              accessibilityLabel={t('settings_notifications.toggle_label')}
            />
          </View>
        </Card>

        {permission === 'denied' && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note
              tone="warn"
              icon={BLOCKED_GLYPH}
              action={{ label: t('settings_notifications.open_settings'), onPress: () => void handleOpenSettings() }}
            >
              {t('settings_notifications.blocked_note')}
            </Note>
          </View>
        )}

        {saveError && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note tone="danger" icon={ERROR_GLYPH}>
              {t('settings_notifications.save_error')}
            </Note>
          </View>
        )}

        {viewState === 'enabled' && (
          <View>
            <Text variant="h3" style={{ marginTop: theme.space['5'] }}>
              {t('settings_notifications.time_section')}
            </Text>
            <View
              style={{
                marginTop: theme.space['3'],
                backgroundColor: theme.colors.surface1,
                borderRadius: theme.radius.card,
                borderWidth: componentMetrics.borderWidth.hairline,
                borderColor: theme.colors.border,
                overflow: 'hidden',
              }}
            >
              {SETTINGS_TIME_PRESETS.map((preset, index) => (
                <View key={preset.id}>
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
                    <Radio
                      selected={!showCustomEditor && selection.kind === 'preset' && selection.id === preset.id}
                      onPress={() => selectPreset(preset)}
                      accessibilityLabel={presetLabel(t, preset.id)}
                    />
                    <View>
                      <Text style={{ fontSize: componentMetrics.listRow.titleFontSize }}>
                        {presetLabel(t, preset.id)}
                      </Text>
                      <Text variant="small">{formatWallClockLabel(preset.timeOfDay)}</Text>
                    </View>
                  </View>
                </View>
              ))}
              <View
                style={{
                  borderTopWidth: componentMetrics.borderWidth.hairline,
                  borderTopColor: theme.colors.border,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space['3'],
                  paddingVertical: theme.space['4'],
                  paddingHorizontal: theme.space['5'],
                }}
              >
                <Radio
                  selected={showCustomEditor}
                  onPress={() => setCustomEditingActive(true)}
                  accessibilityLabel={t('settings_notifications.preset_custom')}
                />
                <View>
                  <Text style={{ fontSize: componentMetrics.listRow.titleFontSize }}>
                    {t('settings_notifications.preset_custom')}
                  </Text>
                  <Text variant="small">{formatWallClockLabel(timeOfDay)}</Text>
                </View>
              </View>
            </View>

            {showCustomEditor && (
              <View style={{ marginTop: theme.space['4'] }}>
                <CustomTimeCard
                  label={t('notifications_schedule.custom_label')}
                  timeOfDay={timeOfDay}
                  onChange={setTimeOfDay}
                  meridiemLabels={{
                    am: t('notifications_schedule.meridiem_am'),
                    pm: t('notifications_schedule.meridiem_pm'),
                  }}
                />
              </View>
            )}

            <Text variant="h3" style={{ marginTop: theme.space['5'] }}>
              {t('settings_notifications.days_section')}
            </Text>
            <View style={{ marginTop: theme.space['3'] }}>
              <DayCheckList days={days} onChange={setDays} />
            </View>

            <View style={{ marginTop: theme.space['5'] }}>
              <Button label={t('settings_notifications.cta_save')} onPress={() => void handleSave()} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Note, Text, TopBar } from '../../../src/components/ui';
import { CustomTimeCard } from '../../../src/features/reminders/components/CustomTimeCard';
import { DayCheckList } from '../../../src/features/reminders/components/DayCheckList';
import { TimePresetGrid } from '../../../src/features/reminders/components/TimePresetGrid';
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_TIME } from '../../../src/features/reminders/constants';
import { ONBOARDING_TIME_PRESETS, resolvePresetSelection } from '../../../src/features/reminders/presets';
import { useReminderSettings } from '../../../src/features/reminders/use-reminder-settings';
import { resolveScheduleStep, type ScheduleStep } from '../../../src/features/reminders/view-state';
import type { IsoWeekday } from '../../../src/lib/notifications';
import { fidelityTestId, useFidelityPreview } from '../../../src/lib/fidelity-preview';
import { theme } from '../../../src/theme';

/** Decorative glyphs, not user-facing copy (implementation plan for issue #18, mirroring item
 * #8's Decision 11). */
const CLOCK_GLYPH = '⏰';
const CALENDAR_GLYPH = '📅';
const ERROR_GLYPH = '⚠️';

const WEEKDAYS_ONLY: IsoWeekday[] = [1, 2, 3, 4, 5];

/**
 * `#screen=notifications-schedule` (`time`, `custom-time`, `days` — implementation plan for issue
 * #18, Decision 8). Only reachable after `notifications-intro` granted the permission. The final
 * "Continuar" on the `days` step is the **only** place this item writes and schedules
 * (`useReminderSettings().save`) — Decisions 2, 5.
 */
export default function NotificationsSchedule() {
  const { t } = useTranslation();
  const router = useRouter();
  const { save } = useReminderSettings();
  const preview = useFidelityPreview();

  const [step, setStep] = useState<ScheduleStep>(() =>
    preview.active && preview.state ? (preview.state as ScheduleStep) : 'time',
  );
  const [timeOfDay, setTimeOfDay] = useState<string>(DEFAULT_REMINDER_TIME);
  const [days, setDays] = useState<IsoWeekday[]>(DEFAULT_REMINDER_DAYS as IsoWeekday[]);
  const [saveError, setSaveError] = useState(false);

  const viewState = resolveScheduleStep(step);
  const selection = resolvePresetSelection(timeOfDay, ONBOARDING_TIME_PRESETS);
  const customSelected = viewState === 'custom-time' || selection.kind === 'custom';
  const selectedPresetId = customSelected || selection.kind !== 'preset' ? undefined : selection.id;

  function selectPreset(preset: (typeof ONBOARDING_TIME_PRESETS)[number]): void {
    setTimeOfDay(preset.timeOfDay);
    setStep('time');
  }

  function continueFromTimeStep(): void {
    setStep('days');
  }

  async function continueFromDaysStep(): Promise<void> {
    setSaveError(false);
    const result = await save({ enabled: true, timeOfDay, days });
    if (result.status === 'error') {
      setSaveError(true);
      return;
    }
    // `'permission-lost'` is a rare race (the permission was just granted on the previous
    // screen) — BR6 says reminders never block onboarding, so this still proceeds; the person's
    // schedule is simply not persisted this time, self-healing the next time they visit
    // `settings-notifications` (plan Assumption A8's same "self-healing" rationale).
    router.replace('/(onboarding)/ready');
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('notifications-schedule')}
    >
      <TopBar
        title={t('notifications_schedule.title')}
        onBack={() => router.back()}
        backAccessibilityLabel={t('notifications_schedule.title')}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.space['5'] }}>
        {viewState !== 'days' && (
          <View>
            <Text variant="h2">
              {CLOCK_GLYPH} {t('notifications_schedule.time_title')}
            </Text>
            <Text variant="body" style={{ marginTop: theme.space['2'] }}>
              {t('notifications_schedule.time_body')}
            </Text>
          </View>
        )}
        {viewState === 'days' && (
          <View>
            <Text variant="h2">
              {CALENDAR_GLYPH} {t('notifications_schedule.days_title')}
            </Text>
            <Text variant="body" style={{ marginTop: theme.space['2'] }}>
              {t('notifications_schedule.days_body')}
            </Text>
          </View>
        )}

        {viewState !== 'days' && (
          <View style={{ marginTop: theme.space['5'] }}>
            <TimePresetGrid
              presets={ONBOARDING_TIME_PRESETS}
              selectedPresetId={selectedPresetId}
              onSelectPreset={selectPreset}
              customLabel={t('notifications_schedule.preset_custom')}
              customSelected={customSelected}
              onSelectCustom={() => setStep('custom-time')}
            />
          </View>
        )}

        {viewState === 'custom-time' && (
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

        {viewState === 'days' && (
          <View style={{ marginTop: theme.space['5'] }}>
            <DayCheckList days={days} onChange={setDays} />
            <View style={{ marginTop: theme.space['3'] }}>
              <Button
                variant="outline"
                size="sm"
                label={t('notifications_schedule.weekdays_only')}
                onPress={() => setDays(WEEKDAYS_ONLY)}
              />
            </View>
          </View>
        )}

        {saveError && (
          <View style={{ marginTop: theme.space['5'] }}>
            <Note tone="danger" icon={ERROR_GLYPH}>
              {t('notifications_schedule.save_error')}
            </Note>
          </View>
        )}

        <View style={{ marginTop: theme.space['6'] }}>
          <Button
            label={t('notifications_schedule.cta')}
            onPress={() => (viewState === 'days' ? void continueFromDaysStep() : continueFromTimeStep())}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

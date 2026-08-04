import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Note, Text } from '../../../src/components/ui';
import { SamplePushCard } from '../../../src/features/reminders/components/SamplePushCard';
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_TIME } from '../../../src/features/reminders/constants';
import { useNotificationPermission } from '../../../src/features/reminders/use-notification-permission';
import { useReminderSettings } from '../../../src/features/reminders/use-reminder-settings';
import { resolveIntroState } from '../../../src/features/reminders/view-state';
import { fidelityTestId, useFidelityPreview } from '../../../src/lib/fidelity-preview';
import { theme } from '../../../src/theme';

/** Decorative glyph, not user-facing copy (implementation plan for issue #18, mirroring item #8's
 * Decision 11). */
const BLOCKED_GLYPH = '📵';

/**
 * `#screen=notifications-intro` (`default`, `denied` — implementation plan for issue #18,
 * Decision 8). Permission is requested from exactly this screen's "Habilitar notificaciones"
 * press — never on mount (Decision 7; AC1). `useFidelityPreview()` lets a `__DEV__` capture reach
 * `denied` without revoking a real OS permission (Decision 8).
 */
export default function NotificationsIntro() {
  const { t } = useTranslation();
  const router = useRouter();
  const { permission, error, request } = useNotificationPermission();
  const { save } = useReminderSettings();
  const preview = useFidelityPreview();
  const [skipError, setSkipError] = useState(false);

  const derivedState = resolveIntroState(permission);
  const viewState = preview.active ? (preview.state ?? derivedState) : derivedState;

  async function handleEnable(): Promise<void> {
    const result = await request();
    if (result === 'granted') {
      router.push('/(onboarding)/notifications/schedule');
    }
  }

  async function handleSkip(): Promise<void> {
    setSkipError(false);
    const result = await save({
      enabled: false,
      timeOfDay: DEFAULT_REMINDER_TIME,
      days: DEFAULT_REMINDER_DAYS,
    });
    if (result.status === 'ok') {
      router.replace('/(onboarding)/ready');
      return;
    }
    // Decision 6: "Tal vez después" never blocks onboarding (BR6) — but a failed write must be
    // visible and retryable, not silently swallowed while the button pretends nothing happened.
    setSkipError(true);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('notifications-intro')}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.space['5'] }}>
        <View style={{ marginTop: theme.space['4'] }}>
          <Text variant="eyebrow">{t('notifications_intro.eyebrow')}</Text>
          <Text variant="h1" style={{ marginTop: theme.space['2'] }}>
            {t('notifications_intro.title')}
          </Text>
          <Text variant="bodyLead" style={{ marginTop: theme.space['3'] }}>
            {t('notifications_intro.body')}
          </Text>
        </View>

        <View style={{ marginTop: theme.space['5'] }}>
          <SamplePushCard
            caption={t('notifications_intro.sample_caption')}
            appName={t('notifications_intro.sample_app_name')}
            time={t('notifications_intro.sample_time')}
            title={t('notifications_intro.sample_title')}
            body={t('notifications_intro.sample_body')}
          />
        </View>

        {viewState === 'denied' && (
          <View style={{ marginTop: theme.space['5'] }}>
            <Note tone="warn" icon={BLOCKED_GLYPH}>
              {t('notifications_intro.denied_note')}
            </Note>
          </View>
        )}

        {error !== null && (
          <View style={{ marginTop: theme.space['5'] }}>
            <Note tone="danger" icon={BLOCKED_GLYPH}>
              {t('notifications_intro.permission_error')}
            </Note>
          </View>
        )}

        {skipError && (
          <View style={{ marginTop: theme.space['5'] }}>
            <Note tone="danger" icon={BLOCKED_GLYPH}>
              {t('notifications_intro.skip_error')}
            </Note>
          </View>
        )}

        {viewState === 'default' && (
          <View style={{ marginTop: theme.space['5'], gap: theme.space['3'] }}>
            <Button label={t('notifications_intro.cta_enable')} onPress={() => void handleEnable()} />
            <Button
              variant="ghost"
              label={t('notifications_intro.cta_later')}
              onPress={() => void handleSkip()}
            />
          </View>
        )}
        {viewState === 'denied' && (
          <View style={{ marginTop: theme.space['5'] }}>
            <Button
              label={t('notifications_intro.cta_continue_without')}
              onPress={() => void handleSkip()}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

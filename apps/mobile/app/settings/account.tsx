import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Modal, Note, Text, TopBar } from '../../src/components/ui';
import { ProfileFactRow } from '../../src/features/settings/components/ProfileFactRow';
import { useLocalProfile } from '../../src/features/settings/use-local-profile';
import { useWipeLocalData } from '../../src/features/settings/use-wipe-local-data';
import { toSupportedLocale } from '../../src/i18n/locale';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { screenMetrics, theme } from '../../src/theme';

/**
 * `#screen=settings-account` (`default`, `delete-confirm`) — implementation plan for issue #19,
 * Decisions 5, 7, 10, 15, 16. The confirmation modal is rendered here, not as a separate route
 * (`delete-confirm` is a manifest *state*, not a *screen* — Decision 7).
 *
 * The modal stays visible through both `'confirming'` and `'wiping'` so the confirm/cancel
 * buttons' disabled state (driven by `phase`) is actually observable while the wipe runs; the
 * mockup itself draws no in-flight state for this modal (Assumption A2 — the success path shows
 * no confirmation toast, it simply arrives at `onboarding-intro`).
 */
export default function SettingsAccount() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = toSupportedLocale(i18n.language);
  const profileState = useLocalProfile(locale);
  const { phase, requestDelete, cancelDelete, confirmDelete } = useWipeLocalData();

  const profile = profileState.status === 'ready' ? profileState.profile : undefined;
  const isWiping = phase === 'wiping';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('settings-account')}
    >
      <TopBar
        title={t('settings.account.title')}
        onBack={() => router.push('/settings')}
        backAccessibilityLabel={t('settings.back_label')}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space['5'],
          paddingTop: theme.space['4'],
          paddingBottom: theme.space['8'],
        }}
      >
        <Card>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: screenMetrics.settings.accountDeviceAvatarSize,
                height: screenMetrics.settings.accountDeviceAvatarSize,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.infoBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: screenMetrics.settings.accountDeviceAvatarGlyphSize }}>
                {t('settings.account.device_icon')}
              </Text>
            </View>
            <Text variant="h3" style={{ marginTop: theme.space['3'] }}>
              {t('settings.account.device_title')}
            </Text>
            <View style={{ marginTop: theme.space['3'] }}>
              <Badge tone="ok" label={t('settings.account.device_badge')} />
            </View>
          </View>
        </Card>

        <View style={{ marginTop: theme.space['4'] }}>
          <Card>
            <ProfileFactRow
              label={t('settings.account.rut_label')}
              value={profile?.rut ?? t('settings.account.rut_empty')}
              isFirst
            />
            <ProfileFactRow
              label={t('settings.account.since_label')}
              value={profile?.since ?? t('settings.account.rut_empty')}
            />
            <ProfileFactRow
              label={t('settings.account.storage_label')}
              value={t('settings.account.storage_value')}
            />
            <ProfileFactRow
              label={t('settings.account.movements_label')}
              value={String(profile?.transactionCount ?? 0)}
            />
          </Card>
        </View>

        <View style={{ marginTop: theme.space['4'] }}>
          <Note tone="ok" icon={t('settings.account.privacy_icon')}>
            {t('settings.account.privacy_note')}
          </Note>
        </View>

        {phase === 'failed' && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note tone="danger" icon={t('settings.account.delete_failed_icon')}>
              {t('settings.account.delete_failed')}
            </Note>
          </View>
        )}

        <View style={{ marginTop: theme.space['5'] }}>
          <Button
            variant="dangerSoft"
            label={t('settings.account.delete_cta')}
            onPress={requestDelete}
            disabled={isWiping}
          />
        </View>
      </ScrollView>

      <Modal
        visible={phase === 'confirming' || phase === 'wiping'}
        onRequestClose={cancelDelete}
        icon={t('settings.account.delete_modal_icon')}
        title={t('settings.account.delete_modal_title')}
      >
        <Text variant="body" center>
          {t('settings.account.delete_modal_body')}
        </Text>
        <Text variant="small" center style={{ marginTop: theme.space['3'] }}>
          {t('settings.account.delete_modal_no_backup')}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="outline"
              label={t('settings.account.delete_modal_cancel')}
              onPress={cancelDelete}
              disabled={isWiping}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="danger"
              label={t('settings.account.delete_modal_confirm')}
              onPress={confirmDelete}
              disabled={isWiping}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

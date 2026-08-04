import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../components/ui';
import { chooseInstitution, enterFlow } from '../features/connect-bank/connect-flow-store';
import { theme } from '../theme';
import {
  FIXTURE_PRIMARY_INSTITUTION_ID,
  clearConnectFixtures,
  plantCredentialEntry,
  plantOneSyncedConnection,
  plantTwoSyncedConnections,
} from './connect-fixtures-store';

type PanelAction =
  | 'plant_credential'
  | 'plant_one_connection'
  | 'plant_two_connections'
  | 'clear';
type PanelStatus =
  | { kind: 'idle' }
  | { kind: 'success'; action: PanelAction }
  | { kind: 'error'; error: unknown };

/**
 * `__DEV__`-only panel that makes four otherwise-unreachable connect-bank acceptance criteria
 * verifiable on a dev build without item #10 (sync engine) or item #20 (settings connections
 * list), neither of which is built yet (implementation plan Decision 13): AC18 (`rut-locked`),
 * AC24/AC25 (`single`/`multiple`), and AC27 (entering from settings). Follows
 * `SampleDataPanel.tsx`'s exact shape — never reachable in a release build (see
 * `app/(dev)/connect-fixtures.tsx`'s guard).
 *
 * Every `t()` call site below is a literal key (never a variable), matching item #8's `ready.tsx`
 * precedent.
 */
export function ConnectFlowFixtures() {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });

  async function run(action: PanelAction, task: () => Promise<void>): Promise<void> {
    try {
      await task();
      setStatus({ kind: 'success', action });
    } catch (error: unknown) {
      setStatus({ kind: 'error', error });
    }
  }

  function enterFromSettings(): void {
    enterFlow('settings');
    router.push('/(onboarding)/bank-picker');
  }

  function returnToRejectedForm(): void {
    chooseInstitution(FIXTURE_PRIMARY_INSTITUTION_ID);
    router.push({ pathname: '/(onboarding)/bank-credentials', params: { rejected: '1' } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.space['5'], gap: theme.space['3'] }}>
        <Text variant="h1">{t('dev.connect_fixtures.title')}</Text>
        <Text variant="body">{t('dev.connect_fixtures.description')}</Text>

        <Button
          label={t('dev.connect_fixtures.plant_credential_action')}
          onPress={() => run('plant_credential', plantCredentialEntry)}
        />
        <Button
          variant="outline"
          label={t('dev.connect_fixtures.plant_one_connection_action')}
          onPress={() => run('plant_one_connection', plantOneSyncedConnection)}
        />
        <Button
          variant="outline"
          label={t('dev.connect_fixtures.plant_two_connections_action')}
          onPress={() => run('plant_two_connections', plantTwoSyncedConnections)}
        />
        <Button
          variant="outline"
          label={t('dev.connect_fixtures.enter_from_settings_action')}
          onPress={enterFromSettings}
        />
        <Button
          variant="outline"
          label={t('dev.connect_fixtures.rejected_form_action')}
          onPress={returnToRejectedForm}
        />
        <Button
          variant="danger"
          label={t('dev.connect_fixtures.clear_action')}
          onPress={() => run('clear', clearConnectFixtures)}
        />

        {status.kind === 'success' && status.action === 'plant_credential' && (
          <Text variant="body" tone="brand">
            {t('dev.connect_fixtures.plant_credential_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'plant_one_connection' && (
          <Text variant="body" tone="brand">
            {t('dev.connect_fixtures.plant_one_connection_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'plant_two_connections' && (
          <Text variant="body" tone="brand">
            {t('dev.connect_fixtures.plant_two_connections_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'clear' && (
          <Text variant="body" tone="brand">
            {t('dev.connect_fixtures.clear_success')}
          </Text>
        )}
        {status.kind === 'error' && (
          <Text variant="body" tone="danger">
            {t('dev.connect_fixtures.error', { message: String(status.error) })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

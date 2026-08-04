import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../components/ui';
import { theme } from '../theme';
import { clearScript, installScript, type SyncFixtureScriptId } from './scripted-runner';
import { ensureFixtureConnection } from './sync-fixtures-store';

const SCRIPTS: SyncFixtureScriptId[] = [
  'hold_login',
  'hold_products',
  'hold_transactions',
  'play_full',
  'complete',
  'fail_invalid_credentials',
  'fail_session_closed',
  'fail_network',
  'fail_parse_failed',
];

// `as const satisfies Record<...>` keeps each value's literal type — `t()` is typed against the
// exact key union `i18next.d.ts` derives from `es.json`.
const SCRIPT_ACTION_KEY = {
  hold_login: 'dev.sync_fixtures.hold_login_action',
  hold_products: 'dev.sync_fixtures.hold_products_action',
  hold_transactions: 'dev.sync_fixtures.hold_transactions_action',
  play_full: 'dev.sync_fixtures.play_full_action',
  complete: 'dev.sync_fixtures.complete_action',
  fail_invalid_credentials: 'dev.sync_fixtures.fail_invalid_credentials_action',
  fail_session_closed: 'dev.sync_fixtures.fail_session_closed_action',
  fail_network: 'dev.sync_fixtures.fail_network_action',
  fail_parse_failed: 'dev.sync_fixtures.fail_parse_failed_action',
} as const satisfies Record<SyncFixtureScriptId, string>;

/**
 * `__DEV__`-only bank-syncing fixtures panel (implementation plan Decision 10). Makes every
 * `bank-syncing` state reachable without a real bank: choosing a script installs it
 * (`src/dev/scripted-runner.ts`) and shows which one is selected; *Ir a la pantalla de
 * sincronización* ensures a fixture connection exists (`sync-fixtures-store.ts`) and navigates.
 * Follows `ConnectFlowFixtures.tsx`'s exact shape — never reachable in a release build (see
 * `app/(dev)/sync-fixtures.tsx`'s guard).
 */
export function SyncFixtures() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedScript, setSelectedScript] = useState<SyncFixtureScriptId | null>(null);
  const [error, setError] = useState<unknown>(null);

  function selectScript(scriptId: SyncFixtureScriptId): void {
    installScript(scriptId);
    setSelectedScript(scriptId);
    setError(null);
  }

  function clearSelection(): void {
    clearScript();
    setSelectedScript(null);
  }

  async function goToSyncingScreen(): Promise<void> {
    if (selectedScript === null) return;
    try {
      await ensureFixtureConnection();
      router.push('/(onboarding)/bank-syncing');
    } catch (caught: unknown) {
      setError(caught);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.space['5'], gap: theme.space['3'] }}>
        <Text variant="h1">{t('dev.sync_fixtures.title')}</Text>
        <Text variant="body">{t('dev.sync_fixtures.description')}</Text>

        {SCRIPTS.map((scriptId) => (
          <Button
            key={scriptId}
            variant={selectedScript === scriptId ? 'primary' : 'outline'}
            label={t(SCRIPT_ACTION_KEY[scriptId])}
            onPress={() => selectScript(scriptId)}
          />
        ))}

        {selectedScript !== null && (
          <Text variant="body" tone="brand">
            {t('dev.sync_fixtures.script_selected', { script: t(SCRIPT_ACTION_KEY[selectedScript]) })}
          </Text>
        )}

        <Button
          variant="primary"
          label={t('dev.sync_fixtures.go_to_screen_action')}
          disabled={selectedScript === null}
          onPress={() => void goToSyncingScreen()}
        />
        <Button variant="ghost" label={t('dev.sync_fixtures.clear_selection_action')} onPress={clearSelection} />

        {error !== null && (
          <Text variant="body" tone="danger">
            {t('dev.sync_fixtures.error', { message: String(error) })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

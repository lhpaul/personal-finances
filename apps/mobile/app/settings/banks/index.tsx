import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, Text, TopBar } from '../../../src/components/ui';
import { ConnectedBankRow } from '../../../src/features/banks/components/ConnectedBankRow';
import { DisconnectConfirmModal } from '../../../src/features/banks/components/DisconnectConfirmModal';
import {
  resolveBankCountFragment,
  resolveProductCountFragment,
  summarizeConnections,
} from '../../../src/features/banks/connection-view';
import { fidelityBankConnections } from '../../../src/features/banks/fidelity-presentation';
import { translateFragment } from '../../../src/features/banks/translate-fragment';
import { useBankConnections } from '../../../src/features/banks/use-bank-connections';
import { useDisconnectBank } from '../../../src/features/banks/use-disconnect-bank';
import { enterFlow } from '../../../src/features/connect-bank/connect-flow-store';
import { toSupportedLocale } from '../../../src/i18n/locale';
import { fidelityTestId, useFidelityPreview } from '../../../src/lib/fidelity-preview';
import { theme } from '../../../src/theme';

/** Decorative glyph, not user-facing copy (the mockup's empty-state icon). */
const EMPTY_ICON = '🏦';

/**
 * `#screen=settings-banks` (`list`, `empty`, `disconnect-confirm`) — implementation plan for
 * issue #20, Implementation Order step 9. Composition-only: reads `useBankConnections()`,
 * resolves the `disconnect` route param into the confirm modal's open/closed state (Decision 7),
 * and composes `TopBar` + the summary line + `ConnectedBankRow`s + the two buttons, or
 * `EmptyState` when there are no connections. No SQL, no business logic, no literal copy.
 */
export default function SettingsBanks() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const preview = useFidelityPreview();
  const params = useLocalSearchParams<{ disconnect?: string }>();
  const locale = toSupportedLocale(i18n.language);

  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));

  const dataState = useBankConnections();
  const disconnectHook = useDisconnectBank();

  const liveConnections = dataState.status === 'ready' ? dataState.connections : [];
  const connections = preview.active ? fidelityBankConnections(preview.state) : liveConnections;

  function clearDisconnectParam(): void {
    router.setParams({ disconnect: undefined });
  }

  // Cancelling (or a stale param clearing itself) also drops a lingering 'failed' status —
  // otherwise reopening the modal later, for the same or a different connection, would show a
  // stale failure Note for an attempt that never happened this time.
  function cancelDisconnect(): void {
    disconnectHook.reset();
    clearDisconnectParam();
  }

  // The confirmation target: the connection named by the `disconnect` param, if it still exists
  // in the current list — a stale value (a connection that already disconnected, or was never
  // real) never reopens a modal (Decision 7).
  const disconnectTarget = connections.find((connection) => connection.id === params.disconnect);
  // In preview mode the modal is opened by the preview state itself, never by the route param —
  // a fidelity deep link carries no `disconnect` value (Decision 13).
  const modalOpen = preview.active
    ? preview.state === 'disconnect-confirm'
    : disconnectTarget !== undefined;
  const modalConnection = preview.active ? connections[0] : disconnectTarget;

  function openDisconnectConfirm(connectionId: string): void {
    router.setParams({ disconnect: connectionId });
  }

  function goToBank(institutionId: string): void {
    router.push(`/settings/banks/${institutionId}`);
  }

  function goToPicker(): void {
    enterFlow('settings');
    router.push('/(onboarding)/bank-picker');
  }

  async function confirmDisconnect(): Promise<void> {
    if (modalConnection === undefined) return;
    const outcome = await disconnectHook.run({
      connectionId: modalConnection.id,
      institutionId: modalConnection.institutionId,
    });
    if (outcome?.status === 'disconnected') clearDisconnectParam();
  }

  const { bankCount, productCount } = summarizeConnections(connections);
  const summaryLine = t('settings_banks.summary', {
    banks: translateFragment(t, resolveBankCountFragment(bankCount)),
    products: translateFragment(t, resolveProductCountFragment(productCount)),
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('settings-banks')}
    >
      <TopBar
        title={t('settings_banks.title')}
        onBack={() => router.push('/settings')}
        backAccessibilityLabel={t('settings_banks.back_label')}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.space['5'] }}>
        {connections.length === 0 ? (
          <EmptyState
            icon={EMPTY_ICON}
            title={t('settings_banks.empty_title')}
            description={t('settings_banks.empty_body')}
            action={{ label: t('settings_banks.empty_cta'), onPress: goToPicker }}
          />
        ) : (
          <>
            <Text variant="small" tone="secondary" style={{ marginTop: theme.space['4'] }}>
              {summaryLine}
            </Text>
            <View style={{ gap: theme.space['3'], marginTop: theme.space['3'] }}>
              {connections.map((connection) => (
                <ConnectedBankRow
                  key={connection.id}
                  connection={connection}
                  now={now}
                  locale={locale}
                  onPress={goToBank}
                />
              ))}
            </View>
            <View style={{ marginTop: theme.space['4'] }}>
              <Button variant="outline" label={t('settings_banks.add_bank')} onPress={goToPicker} />
            </View>
            <View style={{ marginTop: theme.space['2'], gap: theme.space['2'] }}>
              {connections.map((connection) => (
                <Button
                  key={connection.id}
                  variant="ghost"
                  label={t('settings_banks.disconnect_named', { bank: connection.name })}
                  onPress={() => openDisconnectConfirm(connection.id)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <DisconnectConfirmModal
        visible={modalOpen}
        bankName={modalConnection?.name ?? ''}
        disabled={disconnectHook.status === 'running'}
        failed={disconnectHook.status === 'failed'}
        onCancel={cancelDisconnect}
        onConfirm={() => void confirmDisconnect()}
      />
    </SafeAreaView>
  );
}

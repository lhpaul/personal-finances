import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/ui';
import { ConnectedBankSummaryList } from '../../src/features/connect-bank/components/ConnectedBankSummaryList';
import { reset } from '../../src/features/connect-bank/connect-flow-store';
import { resolveExitHref } from '../../src/features/connect-bank/flow-navigation';
import { useConnectFlow } from '../../src/features/connect-bank/use-connect-flow';
import { useConnectedBanks } from '../../src/features/connect-bank/use-connected-banks';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

/**
 * `#screen=bank-connected` (`single`, `multiple`) — implementation plan Implementation Order
 * step 9, Decision 15. Unreachable except through a completed sync (AC23): when
 * `listConnectedBankSummaries` returns nothing, this redirects back to wherever the flow was
 * entered from rather than drawing an invented "nothing connected" state the mockup never
 * declares.
 */
export default function BankConnected() {
  const { t } = useTranslation();
  const router = useRouter();
  const { entryOrigin } = useConnectFlow();
  const state = useConnectedBanks();

  function addAnotherBank(): void {
    router.push('/(onboarding)/bank-picker');
  }

  function finish(): void {
    const exitHref = resolveExitHref(entryOrigin);
    reset();
    router.push(exitHref as never);
  }

  if (state.status === 'pending') return null;
  // `useConnectedBanks` already re-throws during render on an 'error' status (reaching the
  // route's ErrorBoundary) — this narrows the type for the 'ready' branch below.
  if (state.status === 'error') throw state.error;
  if (state.connections.length === 0) {
    return <Redirect href={resolveExitHref(entryOrigin) as never} />;
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('bank-connected')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.space['5'],
        }}
      >
        <ConnectedBankSummaryList
          connections={state.connections}
          copy={{
            headingSingle: t('connect_connected.heading_single'),
            headingMultiple: t('connect_connected.heading_multiple'),
            congratulation: t('connect_connected.congratulation'),
            productsCount: (count) => t('connect_connected.products_count', { count }),
            movementsCount: (count) => t('connect_connected.movements_count', { count }),
          }}
        />

        {/* `.mu-btn-stack` (mockup) — a fixed gap between the two stacked actions. */}
        <View style={{ marginTop: theme.space['6'], gap: theme.space['3'] }}>
          <Button
            variant="outline"
            label={t('connect_connected.add_another_cta')}
            onPress={addAnotherBank}
          />
          <Button label={t('connect_connected.ready_cta')} onPress={finish} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

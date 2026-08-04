import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Note, Text, TopBar } from '../../../src/components/ui';
import { BankProductRow } from '../../../src/features/banks/components/BankProductRow';
import { BankStatusCard } from '../../../src/features/banks/components/BankStatusCard';
import { resolveBankReviewState } from '../../../src/features/banks/connection-view';
import { fidelityBankReview } from '../../../src/features/banks/fidelity-presentation';
import { sortProductsForDisplay } from '../../../src/features/banks/product-view';
import { resolveSyncErrorKey } from '../../../src/features/banks/sync-error-copy';
import { translateFragment } from '../../../src/features/banks/translate-fragment';
import { useBankReview } from '../../../src/features/banks/use-bank-review';
import { chooseInstitution, enterFlow } from '../../../src/features/connect-bank/connect-flow-store';
import { buildSyncRequest, setPendingSyncHandoff, SYNCING_ROUTE } from '../../../src/features/connect-bank/sync-handoff';
import { toSupportedLocale } from '../../../src/i18n/locale';
import { credentialsKeyFor } from '../../../src/lib/secure-store/credential-store';
import { fidelityTestId, useFidelityPreview } from '../../../src/lib/fidelity-preview';
import { AUTOMATIC_SYNC_INTERVAL_MS } from '../../../src/features/sync/auto-sync';
import { theme } from '../../../src/theme';

const MILLISECONDS_PER_HOUR = 3_600_000;

/**
 * `#screen=bank-review` (`ok`, `error`) — implementation plan for issue #20, Implementation Order
 * step 9, Decision 13. Composition-only: reads `useBankReview(bankId)`, redirects to
 * `/settings/banks` when there is no live connection, and composes `TopBar` + `BankStatusCard` +
 * the error `Note` + the products section + the auto-sync `Note` + the button stack. The
 * `disconnect-confirm` modal is not rendered here — *Desconectar banco* navigates to
 * `/settings/banks` with the `disconnect` param, which owns that state (Decision 7).
 */
export default function BankReview() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { bankId } = useLocalSearchParams<{ bankId: string }>();
  const preview = useFidelityPreview();
  const locale = toSupportedLocale(i18n.language);

  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));

  const dataState = useBankReview(bankId);

  if (!preview.active && dataState.status === 'not_found') {
    return <Redirect href="/settings/banks" />;
  }

  const previewData = preview.active ? fidelityBankReview(preview.state) : undefined;
  const live = dataState.status === 'ready' ? dataState : undefined;
  const maybeConnection = previewData?.connection ?? live?.connection;
  const products = previewData?.products ?? live?.products ?? [];

  if (maybeConnection === undefined) {
    // `pending` (still bootstrapping) or `error` (re-thrown during render by useBankReview, via
    // its own `if (state.status === 'error') throw state.error` — this branch is unreachable for
    // that status and exists only so the component stays defensively total).
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
        testID={fidelityTestId('bank-review')}
      />
    );
  }
  // A fresh, never-reassigned binding with the narrowed (non-undefined) type — TypeScript's
  // control-flow narrowing above does not persist into the nested function declarations below,
  // which close over whichever binding they reference (`connection`, not `maybeConnection`).
  const connection = maybeConnection;

  const state = resolveBankReviewState(connection);
  const sortedProducts = sortProductsForDisplay(products);
  const errorFragment = resolveSyncErrorKey(connection);
  const isSyncing = connection.syncStatus === 'syncing';

  function goToSyncNow(): void {
    enterFlow('settings');
    chooseInstitution(connection.institutionId);
    setPendingSyncHandoff(
      buildSyncRequest(
        {
          userFinancialInstitutionId: connection.id,
          credentialsKey: credentialsKeyFor(connection.institutionId),
        },
        connection.institutionId,
      ),
    );
    router.push(SYNCING_ROUTE);
  }

  function goToUpdateCredentials(): void {
    enterFlow('settings');
    chooseInstitution(connection.institutionId);
    router.push('/(onboarding)/bank-credentials');
  }

  function goToDisconnectConfirm(): void {
    router.push({ pathname: '/settings/banks', params: { disconnect: connection.id } });
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('bank-review')}
    >
      <TopBar
        title={connection.name}
        onBack={() => router.push('/settings/banks')}
        backAccessibilityLabel={t('bank_review.back_label')}
      />
      <ScrollView contentContainerStyle={{ padding: theme.space['5'] }}>
        <BankStatusCard connection={connection} state={state} now={now} locale={locale} />

        {state === 'error' && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note tone="danger" icon={t('bank_review.error_icon')}>
              {translateFragment(t, errorFragment)}
            </Note>
          </View>
        )}

        <Text variant="h3" style={{ marginTop: theme.space['5'] }}>
          {t('bank_review.products_title')}
        </Text>
        <View style={{ marginTop: theme.space['3'], gap: theme.space['3'] }}>
          {sortedProducts.map((product) => (
            <BankProductRow key={product.id} product={product} />
          ))}
        </View>

        <View style={{ marginTop: theme.space['4'] }}>
          <Note tone="info" icon={t('bank_review.auto_sync_icon')}>
            {t('bank_review.auto_sync_note', { hours: AUTOMATIC_SYNC_INTERVAL_MS / MILLISECONDS_PER_HOUR })}
          </Note>
        </View>

        <View style={{ marginTop: theme.space['5'], gap: theme.space['3'] }}>
          {state === 'error' ? (
            <Button label={t('bank_review.update_credentials')} onPress={goToUpdateCredentials} />
          ) : (
            <Button
              variant="outline"
              label={t('bank_review.sync_now')}
              onPress={goToSyncNow}
              disabled={isSyncing}
            />
          )}
          <Button variant="ghost" label={t('bank_review.disconnect')} onPress={goToDisconnectConfirm} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

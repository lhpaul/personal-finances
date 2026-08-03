import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CredentialForm } from '../../src/features/connect-bank/components/CredentialForm';
import { FlowHeader } from '../../src/features/connect-bank/components/FlowHeader';
import { canConnect, formatRutForDisplay } from '../../src/features/connect-bank/credential-form';
import { useConnectBank } from '../../src/features/connect-bank/use-connect-bank';
import { useConnectFlow } from '../../src/features/connect-bank/use-connect-flow';
import { useInstitutions } from '../../src/features/connect-bank/use-institutions';
import { useRutLock } from '../../src/features/connect-bank/use-rut-lock';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

const MONOGRAM_LENGTH = 3;

/**
 * `#screen=bank-credentials` (`empty`, `filled`, `error`, `rut-locked`) — implementation plan
 * Implementation Order step 9. Reads the chosen institution from the module-scoped flow store
 * (Decision 1), the RUT lock from the secure store (Decision 6), and drives `connectBank`
 * through `useConnectBank` (Decision 7).
 *
 * The `rejected` param is the dev-fixtures-only stand-in for item #11's failure path (which does
 * not exist yet, Decision 13) — it composes with the RUT lock exactly as spec UX Rules describe:
 * a locked RUT and a rejection message can both be true at once.
 */
export default function BankCredentials() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ rejected?: string }>();
  const { institutionId } = useConnectFlow();
  const institutionsState = useInstitutions();
  const rutLockState = useRutLock();
  const { state: connectState, connect } = useConnectBank();

  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');

  const locked = rutLockState.status === 'locked';

  useEffect(() => {
    if (rutLockState.status === 'locked') {
      setRut(formatRutForDisplay(rutLockState.rut));
    }
  }, [rutLockState]);

  const institution =
    institutionsState.status === 'ready'
      ? institutionsState.institutions.find((candidate) => candidate.id === institutionId)
      : undefined;

  function goToPicker(): void {
    router.push('/(onboarding)/bank-picker');
  }

  async function handleConnect(): Promise<void> {
    if (institutionId === null) return;
    await connect({ institutionId, rut, password });
  }

  const isRejected = params.rejected === '1' || connectState.status === 'error';
  const errorMessage = isRejected ? t('connect_credentials.error_hint') : undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['bottom']}
      testID={fidelityTestId('bank-credentials')}
    >
      <FlowHeader
        title={institution?.name ?? ''}
        backAccessibilityLabel={t('connect_credentials.back_label')}
        onBack={goToPicker}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['10'] }}
      >
        <CredentialForm
          bankMonogram={
            institution?.shortName ?? institution?.name.slice(0, MONOGRAM_LENGTH).toUpperCase() ?? ''
          }
          bankMonogramColor={institution?.brandColor ?? theme.colors.brandPrimary}
          bankName={institution?.name ?? ''}
          rut={rut}
          onChangeRut={locked ? () => undefined : (value) => setRut(formatRutForDisplay(value))}
          password={password}
          onChangePassword={setPassword}
          locked={locked}
          errorMessage={errorMessage}
          canConnect={canConnect({ rut, password }) && connectState.status !== 'connecting'}
          onConnect={handleConnect}
          onCancel={goToPicker}
          copy={{
            subtitle: t('connect_credentials.subtitle'),
            privacyNote: t('connect_credentials.privacy_note'),
            rutLabel: t('connect_credentials.rut_label'),
            rutPlaceholder: t('connect_credentials.rut_placeholder'),
            passwordLabel: t('connect_credentials.password_label'),
            passwordPlaceholder: t('connect_credentials.password_placeholder'),
            rutLockedHint: t('connect_credentials.rut_locked_hint'),
            connectCta: t('connect_credentials.connect_cta'),
            cancelCta: t('connect_credentials.cancel_cta'),
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '../components/ui';
import { createExpoCipherDatabasePort } from '../db/client';
import { runEncryptionDiagnostics } from '../db/encryption/diagnostics';
import { getLastResolvedEncryptionState } from '../db/encryption/open-encrypted-store';
import type { EncryptionDiagnostics } from '../db/encryption/types';
import { createRuntimePorts } from '../db/runtime';
import { expoSecureStoreAdapter } from '../lib/secure-store/expo-secure-store.adapter';
import { theme } from '../theme';

type ProbeStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; diagnostics: EncryptionDiagnostics }
  | { kind: 'error'; error: unknown };

/**
 * The rendering half of the encryption diagnostics probe (implementation plan for issue #25,
 * Decision 12) — this file imports **no** SQL library, only
 * `src/db/encryption/diagnostics.ts`'s `runEncryptionDiagnostics(deps)` and the two adapter
 * builders (`createExpoCipherDatabasePort`, `expoSecureStoreAdapter`) it needs to call it, so
 * `db-access-boundary.test.ts` (V31) keeps passing unchanged even though this component lives
 * under `src/dev/`, not `src/db/`.
 *
 * `__DEV__`-gated by its own caller (`app/(dev)/gallery.tsx`, mirroring every other panel under
 * `src/dev/` — the repository's established never-ships convention) and reachable only from
 * `finanzas://gallery`, per the smoke-test runbook's own navigation instructions.
 */
export function EncryptionProbeSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProbeStatus>({ kind: 'idle' });

  const runProbe = useCallback(async () => {
    setStatus({ kind: 'running' });
    try {
      const port = createExpoCipherDatabasePort();
      const diagnostics = await runEncryptionDiagnostics({
        port,
        secureStore: expoSecureStoreAdapter,
        digestSha256: createRuntimePorts().digestSha256,
        resolvedState: getLastResolvedEncryptionState(),
      });
      setStatus({ kind: 'done', diagnostics });
    } catch (error: unknown) {
      setStatus({ kind: 'error', error });
    }
  }, []);

  const outcomeCopy = (outcome: 'succeeded' | 'failed'): string =>
    outcome === 'succeeded' ? t('dev.encryption_probe.outcome_succeeded') : t('dev.encryption_probe.outcome_failed');

  return (
    <View style={{ marginTop: theme.space['5'] }}>
      <Text variant="eyebrow">{t('dev.encryption_probe.title')}</Text>
      <View style={{ marginTop: theme.space['2'], gap: theme.space['3'] }}>
        <Text variant="body">{t('dev.encryption_probe.description')}</Text>

        <Button
          variant="outline"
          label={t('dev.encryption_probe.run_action')}
          onPress={() => void runProbe()}
        />

        {status.kind === 'running' && <Text variant="body">{t('dev.encryption_probe.running')}</Text>}

        {status.kind === 'error' && (
          <Text variant="body" tone="danger">
            {t('dev.encryption_probe.error', { message: String(status.error) })}
          </Text>
        )}

        {status.kind === 'done' && (
          <View style={{ gap: theme.space['1'] }}>
            <Text variant="body">
              {status.diagnostics.cipherVersion === null
                ? t('dev.encryption_probe.cipher_version', { value: t('dev.encryption_probe.cipher_version_absent') })
                : t('dev.encryption_probe.cipher_version', { value: status.diagnostics.cipherVersion })}
            </Text>
            <Text variant="body">
              {t(status.diagnostics.keyPresent ? 'dev.encryption_probe.key_present_yes' : 'dev.encryption_probe.key_present_no')}
            </Text>
            {status.diagnostics.keyFingerprint !== undefined && (
              <Text variant="body">
                {t('dev.encryption_probe.key_fingerprint', { value: status.diagnostics.keyFingerprint })}
              </Text>
            )}
            <Text variant="body">
              {status.diagnostics.resolvedState === undefined
                ? t('dev.encryption_probe.resolved_state', { value: t('dev.encryption_probe.resolved_state_absent') })
                : t('dev.encryption_probe.resolved_state', { value: status.diagnostics.resolvedState })}
            </Text>
            <Text variant="body">
              {t('dev.encryption_probe.open_without_key', { value: outcomeCopy(status.diagnostics.openWithoutKey) })}
            </Text>
            <Text variant="body">
              {t('dev.encryption_probe.open_with_wrong_key', { value: outcomeCopy(status.diagnostics.openWithWrongKey) })}
            </Text>
            <Text variant="body">
              {t('dev.encryption_probe.open_with_stored_key', { value: outcomeCopy(status.diagnostics.openWithStoredKey) })}
            </Text>

            {status.diagnostics.tableRowCounts !== undefined && (
              <View style={{ marginTop: theme.space['2'], gap: theme.space['1'] }}>
                <Text variant="eyebrow">{t('dev.encryption_probe.row_counts_title')}</Text>
                {Object.entries(status.diagnostics.tableRowCounts).map(([table, count]) => (
                  <Text key={table} variant="small">
                    {t('dev.encryption_probe.row_count_line', { table, count })}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

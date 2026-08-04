import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../components/ui';
import { theme } from '../theme';
import { clearSampleData, generateDemoMovements, loadSampleData, simulateSampleSyncError } from './sample-store';

type PanelAction = 'load' | 'simulate_error' | 'clear' | 'generate_demo';
type PanelStatus =
  | { kind: 'idle' }
  | { kind: 'success'; action: PanelAction }
  | { kind: 'error'; error: unknown };

/**
 * `__DEV__`-only panel that makes every `#screen=home` state reachable without item #10 (the
 * sync engine, not started) or live bank credentials (implementation plan for issue #12,
 * Decision 11). Never reachable in a release build — see `app/(dev)/sample-data.tsx`'s guard.
 *
 * Every `t()` call site below is a literal key (never a variable), matching item #8's
 * `ready.tsx` precedent — `status.action` only ever selects **which** literal branch renders.
 */
export function SampleDataPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });

  async function run(action: PanelAction, task: () => Promise<void>): Promise<void> {
    try {
      await task();
      setStatus({ kind: 'success', action });
    } catch (error: unknown) {
      setStatus({ kind: 'error', error });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.space['5'], gap: theme.space['4'] }}>
        <Text variant="h1">{t('dev.sample_data.title')}</Text>
        <Text variant="body">{t('dev.sample_data.description')}</Text>

        <Button
          label={t('dev.sample_data.load_action')}
          onPress={() => run('load', loadSampleData)}
        />
        <Button
          variant="outline"
          label={t('dev.sample_data.simulate_error_action')}
          onPress={() => run('simulate_error', simulateSampleSyncError)}
        />
        <Button
          variant="danger"
          label={t('dev.sample_data.clear_action')}
          onPress={() => run('clear', clearSampleData)}
        />
        <Button
          variant="outline"
          label={t('dev.sample_data.generate_demo_action')}
          onPress={() => run('generate_demo', generateDemoMovements)}
        />

        {status.kind === 'success' && status.action === 'load' && (
          <Text variant="body" tone="brand">
            {t('dev.sample_data.load_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'simulate_error' && (
          <Text variant="body" tone="brand">
            {t('dev.sample_data.simulate_error_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'clear' && (
          <Text variant="body" tone="brand">
            {t('dev.sample_data.clear_success')}
          </Text>
        )}
        {status.kind === 'success' && status.action === 'generate_demo' && (
          <Text variant="body" tone="brand">
            {t('dev.sample_data.generate_demo_success')}
          </Text>
        )}
        {status.kind === 'error' && (
          <Text variant="body" tone="danger">
            {t('dev.sample_data.error', { message: String(status.error) })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

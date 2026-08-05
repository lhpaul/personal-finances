import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../components/ui';
import { theme } from '../theme';
import { applyE2eFixtureState, E2E_FIXTURE_STATES, type E2eFixtureStateId } from './e2e-fixture-store';

// `as const satisfies Record<...>` keeps each value's literal type — `t()` is typed against the
// exact key union `i18next.d.ts` derives from `es.json`. Mirrors `SyncFixtures.tsx`'s
// `SCRIPT_ACTION_KEY` (implementation plan for issue #22).
const STATE_ACTION_KEY = {
  reset: 'dev.e2e_fixtures.reset_action',
  'synced-home': 'dev.e2e_fixtures.synced_home_action',
  'stage-queue': 'dev.e2e_fixtures.stage_queue_action',
  'transaction-detail': 'dev.e2e_fixtures.transaction_detail_action',
  'scripted-read': 'dev.e2e_fixtures.scripted_read_action',
} as const satisfies Record<E2eFixtureStateId, string>;

const STATE_SUCCESS_KEY = {
  reset: 'dev.e2e_fixtures.reset_success',
  'synced-home': 'dev.e2e_fixtures.synced_home_success',
  'stage-queue': 'dev.e2e_fixtures.stage_queue_success',
  'transaction-detail': 'dev.e2e_fixtures.transaction_detail_success',
  'scripted-read': 'dev.e2e_fixtures.scripted_read_success',
} as const satisfies Record<E2eFixtureStateId, string>;

type PanelStatus = { kind: 'idle' } | { kind: 'success'; state: E2eFixtureStateId } | { kind: 'error'; error: unknown };

/**
 * `__DEV__`-only fixture panel for the Maestro E2E suite (implementation plan for issue #22, D6).
 * One `Button` per declared fixture state, following `SampleDataPanel.tsx`/`SyncFixtures.tsx`
 * literally (literal `t()` keys only) — never reachable in a release build (see
 * `app/(dev)/e2e-fixtures.tsx`'s guard). `.maestro/shared/fixture.yaml` taps a state's action
 * label and asserts its success line — this panel's copy **is** the flow suite's fixture-state
 * selector surface (D10).
 */
export function E2eFixtures() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });

  async function apply(state: E2eFixtureStateId): Promise<void> {
    try {
      await applyE2eFixtureState(state);
      setStatus({ kind: 'success', state });
    } catch (error: unknown) {
      setStatus({ kind: 'error', error });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: theme.space['5'], gap: theme.space['3'] }}>
        <Text variant="h1">{t('dev.e2e_fixtures.title')}</Text>
        <Text variant="body">{t('dev.e2e_fixtures.description')}</Text>

        {E2E_FIXTURE_STATES.map((state) => (
          <Button key={state} label={t(STATE_ACTION_KEY[state])} onPress={() => void apply(state)} />
        ))}

        {status.kind === 'success' && (
          <Text variant="body" tone="brand">
            {t(STATE_SUCCESS_KEY[status.state])}
          </Text>
        )}
        {status.kind === 'error' && (
          <Text variant="body" tone="danger">
            {t('dev.e2e_fixtures.error', { message: String(status.error) })}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

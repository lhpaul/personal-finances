import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deriveDateLocal, differenceInDays, getMonthPeriod, shiftMonthPeriod } from '@finanzas/shared-utils';

import { Button } from '../../components/ui';
import { countUncategorized } from '../../db/repositories/transactions';
import { getAppDatabase } from '../../db/runtime';
import { useFidelityPreview } from '../../lib/fidelity-preview';
import { theme } from '../../theme';
import { buildCompletionView, type StageOutcome } from './completion';
import { CompletionSummary } from './components/CompletionSummary';
import { readStageSummary, type StageSummary } from './stage-summary';

type CompletionDataState =
  | { status: 'pending' }
  | { status: 'ready'; pendingNow: number; summary: StageSummary }
  | { status: 'error' };

/**
 * Reads the live pending count and the two summary-tile figures at render time — not the stage
 * session — because the completion screen must also render cold (a deep link, or a fidelity
 * capture), following the same `getAppDatabase()`-then-repository shape `useOnboardingSummary`
 * uses (implementation plan Decision 16). Not independently hook-tested for the same reason
 * `useOnboardingSummary` / `useLaunchDecision` are not (Verification Log — no renderer).
 */
function useCompletionData(): CompletionDataState {
  const [state, setState] = useState<CompletionDataState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    getAppDatabase()
      .then((db) => {
        if (cancelled) return;
        const today = deriveDateLocal(new Date());
        const period = getMonthPeriod(today);
        const previousPeriod = shiftMonthPeriod(period, -1);
        const elapsedDays = differenceInDays(period.start, today) + 1;
        setState({
          status: 'ready',
          pendingNow: countUncategorized(db),
          summary: readStageSummary(db, { period, previousPeriod, elapsedDays }),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function parseCount(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export interface CategorizeCompleteScreenProps {
  /** `fidelityTestId('categorize-complete')` — computed and passed down by the route file
   * (`app/categorize/complete.tsx`); see `StageIntroScreenProps.testID`'s doc comment for why. */
  testID?: string;
}

/**
 * `#screen=categorize-complete` (spec Use Cases 8, 9; UX Rules → Completion; AC28, AC30, AC31).
 * `resolved` / `pendingAtStart` travel as route params from `CategorizeScreen` (Decision 10);
 * entered without them (a deep link, or a fidelity capture) falls back to `0` (Assumption P5).
 */
export function CategorizeCompleteScreen({ testID }: CategorizeCompleteScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ resolved?: string; pendingAtStart?: string }>();
  const data = useCompletionData();
  const preview = useFidelityPreview();

  if (data.status !== 'ready') {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }

  const resolved = parseCount(params.resolved);
  const pendingAtStart = parseCount(params.pendingAtStart);

  const view = buildCompletionView({
    pendingNow: data.pendingNow,
    resolved,
    pendingAtStart,
    totalCategorized: data.summary.totalCategorized,
  });

  const outcome: StageOutcome = preview.active
    ? preview.state === 'done'
      ? 'done'
      : 'partial'
    : view.outcome;

  function handleContinue(): void {
    router.replace('/categorize');
  }

  function handleDoneForToday(): void {
    router.replace('/(tabs)/home');
  }

  function handleGoHome(): void {
    router.replace('/(tabs)/home');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']} testID={testID}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.space['5'], paddingBottom: theme.space['6'] }}>
        <View style={{ marginTop: theme.space['6'] }}>
          <CompletionSummary
            outcome={outcome}
            resolved={view.resolved}
            total={view.total}
            ratio={view.ratio}
            dailyAverageMinorUnits={data.summary.dailyAverageMinorUnits}
            changeDirection={data.summary.change.direction}
            changePercentLabel={data.summary.change.percentLabel}
          />
        </View>

        <View style={{ marginTop: theme.space['6'] }}>
          {outcome === 'partial' ? (
            <View style={{ gap: theme.space['3'] }}>
              <Button label={t('categorize_complete.continue')} onPress={handleContinue} />
              <Button variant="ghost" label={t('categorize_complete.done_for_today')} onPress={handleDoneForToday} />
            </View>
          ) : (
            <Button label={t('categorize_complete.go_home')} onPress={handleGoHome} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

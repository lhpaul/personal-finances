import { deriveDateLocal, formatMonthAbbreviation } from '@finanzas/shared-utils';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segment } from '../src/components/ui';
import { toSupportedLocale } from '../src/i18n/locale';
import { fidelityTestId, useFidelityPreview } from '../src/lib/fidelity-preview';
import { theme } from '../src/theme';
import { CategoryReportCard } from '../src/features/dashboard/components/CategoryReportCard';
import { DashboardTopBar } from '../src/features/dashboard/components/DashboardTopBar';
import { SpendingOverviewCard } from '../src/features/dashboard/components/SpendingOverviewCard';
import { TrendCard } from '../src/features/dashboard/components/TrendCard';
import { buildSpendingOverview } from '../src/features/dashboard/spending-overview';
import { buildTrendReport } from '../src/features/dashboard/trend-report';
import { resolveDashboardPeriods, type DashboardPeriodType } from '../src/features/dashboard/dashboard-period';
import { useDashboardData } from '../src/features/dashboard/use-dashboard-data';

function isDashboardPeriodType(value: string | null): value is DashboardPeriodType {
  return value === 'month' || value === 'week';
}

/**
 * `#screen=dashboard` (implementation plan for issue #17). Composition-only: derives `now` ->
 * `deriveDateLocal` -> the six period boundaries once (Decision 3 — the clock enters this
 * feature exactly once, at the route, unlike the `home` tab route which re-reads it on every
 * focus), owns the `month` / `week` segment, calls `useDashboardData`, and composes the topbar,
 * the segment and the three cards. No SQL, no business logic, no literal copy.
 *
 * Every `useMemo` call runs unconditionally, before the `status !== 'ready'` early return (Rules
 * of Hooks) — mirrors `home`'s own established shape (found in its review).
 */
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = toSupportedLocale(i18n.language);
  const preview = useFidelityPreview();

  // Decision 3: the clock is read once, at mount — this is a pushed route, not a tab that stays
  // mounted for a whole session, so it does not need `home`'s focus-driven re-derivation.
  const [now] = useState(() => new Date());
  const dateLocal = deriveDateLocal(now);

  const [localPeriodType, setLocalPeriodType] = useState<DashboardPeriodType>('month');
  // Decision 13: the fidelity harness overrides the local segment value with the requested state.
  const periodType: DashboardPeriodType =
    preview.active && isDashboardPeriodType(preview.state) ? preview.state : localPeriodType;

  const periods = useMemo(() => resolveDashboardPeriods(dateLocal, periodType), [dateLocal, periodType]);
  const state = useDashboardData({
    period: periods.period,
    previousPeriod: periods.previousPeriod,
    trendWindow: periods.trendWindow,
    locale,
  });

  const trendReport = useMemo(
    () => (state.status === 'ready' ? buildTrendReport(state.data.windowDailyTotals, periods.periodStarts) : undefined),
    [state, periods.periodStarts],
  );
  const spendingOverview = useMemo(
    () => (trendReport === undefined ? undefined : buildSpendingOverview(trendReport.expenseSeries)),
    [trendReport],
  );
  const previousMonthLabel = useMemo(
    () => formatMonthAbbreviation(periods.previousPeriod.start, locale),
    [periods.previousPeriod.start, locale],
  );
  const currentMonthLabel = useMemo(
    () => formatMonthAbbreviation(periods.period.start, locale),
    [periods.period.start, locale],
  );

  const goBack = useCallback(() => router.back(), [router]);
  const goToSettings = useCallback(() => router.push('/settings'), [router]);

  // Assumption A13: while the database is bootstrapping, dashboard renders nothing; a bootstrap
  // failure is re-thrown during render by useDashboardData, reaching the route's ErrorBoundary.
  if (state.status !== 'ready' || trendReport === undefined || spendingOverview === undefined) {
    return null;
  }

  const { data } = state;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('dashboard')}
    >
      <DashboardTopBar onBack={goBack} onPressSettings={goToSettings} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['8'], gap: theme.space['4'] }}
      >
        <View style={{ alignItems: 'center' }}>
          <Segment
            options={[
              { value: 'month', label: t('dashboard.segment_month') },
              { value: 'week', label: t('dashboard.segment_week') },
            ]}
            value={periodType}
            onChange={(value) => setLocalPeriodType(value as DashboardPeriodType)}
          />
        </View>

        <TrendCard report={trendReport} periodType={periodType} />

        <SpendingOverviewCard
          overview={spendingOverview}
          periodType={periodType}
          previousMonthLabel={previousMonthLabel}
          currentMonthLabel={currentMonthLabel}
        />

        <CategoryReportCard
          currentCategoryTotals={data.currentCategoryTotals}
          previousCategoryTotals={data.previousCategoryTotals}
          categories={data.categories}
          periodType={periodType}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

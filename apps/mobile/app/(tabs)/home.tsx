import { deriveDateLocal, formatMonthYear, getMonthPeriod, shiftMonthPeriod } from '@finanzas/shared-utils';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dots, ScreenHeader } from '../../src/components/ui';
import { toSupportedLocale } from '../../src/i18n/locale';
import { theme } from '../../src/theme';
import { AllClearHero } from '../../src/features/home/components/AllClearHero';
import { ChallengeHero } from '../../src/features/home/components/ChallengeHero';
import { CategoryBreakdownCard } from '../../src/features/home/components/CategoryBreakdownCard';
import { ConnectedBanksCard } from '../../src/features/home/components/ConnectedBanksCard';
import { FinancialSummaryCard } from '../../src/features/home/components/FinancialSummaryCard';
import { FirstSyncEmptyState } from '../../src/features/home/components/FirstSyncEmptyState';
import { RecentMovementsSection } from '../../src/features/home/components/RecentMovementsSection';
import { SyncErrorNote } from '../../src/features/home/components/SyncErrorNote';
import { TrendCard } from '../../src/features/home/components/TrendCard';
import { resolveHomeState } from '../../src/features/home/home-state';
import { describeSyncTime } from '../../src/features/home/relative-time';
import { buildCategoryBreakdown, buildFinancialSummary } from '../../src/features/home/summary';
import { useHomeData } from '../../src/features/home/use-home-data';

/** Decorative glyphs, not user-facing copy (implementation plan Decision 10). */
const HEADER_AVATAR_GLYPH = '💰';
const HEADER_SETTINGS_GLYPH = '⚙️';

/** The three `mu-dots` under the hero — a decorative indicator with the first dot active, not a
 * carousel (Assumption A3). */
const HERO_DOTS_TOTAL = 3;
const HERO_DOTS_ACTIVE = 1;

/**
 * `#screen=home` (implementation plan for issue #12). Composition-only: derives `now` -> the
 * current and previous month periods once (Decision 8 — `getMonthPeriod(deriveDateLocal(now))`,
 * never UTC), calls `useHomeData`, resolves the manifest state (Decision 4), and composes the
 * four-state layout. No SQL, no business logic, no literal copy.
 */
export default function Home() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = toSupportedLocale(i18n.language);

  const now = useMemo(() => new Date(), []);
  const period = useMemo(() => getMonthPeriod(deriveDateLocal(now)), [now]);
  const previousPeriod = useMemo(() => shiftMonthPeriod(period, -1), [period]);

  const state = useHomeData({ period, previousPeriod, locale });

  // Assumption A15: while the database is bootstrapping, home renders nothing; a bootstrap
  // failure is re-thrown during render by useHomeData, reaching the route's ErrorBoundary.
  if (state.status !== 'ready') return null;

  const { data } = state;
  const homeState = resolveHomeState({
    connections: data.connections,
    uncategorizedCount: data.uncategorizedCount,
  });

  const monthLabel = formatMonthYear(period.start, locale);
  const previousMonthLabel = formatMonthYear(previousPeriod.start, locale);
  const financialSummary = buildFinancialSummary(data.categoryTotals);
  const categoryBuckets = buildCategoryBreakdown(data.categoryTotals);
  const erroredConnection = data.connections.find((connection) => connection.syncStatus === 'error');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top']}>
      <ScreenHeader
        avatar={HEADER_AVATAR_GLYPH}
        avatarTone="brand"
        title={t('home.header_title')}
        subtitle={t('home.header_subtitle')}
        action={{
          icon: HEADER_SETTINGS_GLYPH,
          accessibilityLabel: t('home.header_settings_action'),
          onPress: () => router.push('/settings'),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['8'], gap: theme.space['5'] }}
      >
        {homeState === 'empty' ? (
          <FirstSyncEmptyState />
        ) : (
          <>
            <View>
              {homeState === 'pending' && <ChallengeHero uncategorizedCount={data.uncategorizedCount} />}
              {homeState === 'all-clear' && <AllClearHero />}
              {homeState === 'sync-error' && erroredConnection !== undefined && (
                <SyncErrorNote
                  bankName={erroredConnection.institutionName}
                  lastSuccessDescriptor={
                    erroredConnection.lastSuccessAt === null
                      ? undefined
                      : describeSyncTime(now, erroredConnection.lastSuccessAt)
                  }
                  locale={locale}
                  onRetry={() => router.push(`/settings/banks/${erroredConnection.id}`)}
                />
              )}
              <View style={{ marginTop: theme.space['4'] }}>
                <Dots total={HERO_DOTS_TOTAL} current={HERO_DOTS_ACTIVE} />
              </View>
            </View>

            <FinancialSummaryCard summary={financialSummary} monthLabel={monthLabel} />

            <TrendCard
              dailyTotals={data.dailyTotals}
              previousDailyTotals={data.previousDailyTotals}
              period={period}
              previousPeriod={previousPeriod}
              monthLabel={monthLabel}
              previousMonthLabel={previousMonthLabel}
              onPressViewFull={() => router.push('/dashboard')}
            />

            <CategoryBreakdownCard
              buckets={categoryBuckets}
              categories={data.categories}
              monthLabel={monthLabel}
              onPressViewFull={() => router.push('/dashboard')}
            />

            <RecentMovementsSection
              movements={data.recentMovements}
              locale={locale}
              onPressViewAll={() => router.push('/(tabs)/transactions')}
              onPressMovement={(transactionId) => router.push(`/transactions/${transactionId}`)}
            />

            <ConnectedBanksCard
              connections={data.connections}
              now={now}
              locale={locale}
              onPressBank={(connectionId) => router.push(`/settings/banks/${connectionId}`)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

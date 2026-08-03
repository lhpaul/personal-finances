import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenHeader } from '../../src/components/ui';
import { componentMetrics, theme } from '../../src/theme';
import { ManualTransactionSheet } from '../../src/features/transactions/components/ManualTransactionSheet';
import { MonthHeader } from '../../src/features/transactions/components/MonthHeader';
import { MovementRow } from '../../src/features/transactions/components/MovementRow';
import { SearchSummary } from '../../src/features/transactions/components/SearchSummary';
import { TransactionsEmptyState } from '../../src/features/transactions/components/TransactionsEmptyState';
import { TransactionsFilterSheet } from '../../src/features/transactions/components/TransactionsFilterSheet';
import { TransactionsSearchBar } from '../../src/features/transactions/components/TransactionsSearchBar';
import { isDefaultFilters } from '../../src/features/transactions/filters';
import type { TransactionListEntry } from '../../src/features/transactions/grouping';
import { buildListEntries, getEntryType } from '../../src/features/transactions/grouping';
import { resolveTransactionsState } from '../../src/features/transactions/list-state';
import { useTransactionsList } from '../../src/features/transactions/use-transactions-list';
import { toSupportedLocale } from '../../src/i18n/locale';
import { fidelityTestId, useFidelityPreview } from '../../src/lib/fidelity-preview';

/** Decorative glyphs, not user-facing copy (implementation plan Decision 10). */
const HEADER_AVATAR_GLYPH = '💳';
const HEADER_FILTERS_GLYPH = '⚙';

/** The two search terms the mockup itself draws (Decision 15) — seeded for the `search`/`empty`
 * fidelity targets so the comparison runs against the same inputs the mockup used. */
const FIDELITY_SEARCH_TERM = 'uber';
const FIDELITY_EMPTY_TERM = 'zzz';

/**
 * `#screen=transactions` (implementation plan for issue #15). Composition-only: calls
 * `useTransactionsList`, resolves the manifest state (Decision 9), seeds fidelity-preview state
 * (Decision 15), and composes `ScreenHeader`, the search bar, the `FlashList`, the two sheets and
 * the manual-entry button. No SQL, no business logic, no literal copy.
 */
export default function Transactions() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = toSupportedLocale(i18n.language);
  const fidelityPreview = useFidelityPreview();

  const [filterSheetOpen, setFilterSheetOpen] = useState(() => fidelityPreview.state === 'filters');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const list = useTransactionsList({ locale });

  // Decision 15: seeds the `search`/`empty` fidelity targets' committed term once, on mount.
  // `useFidelityPreview()` returns `{ active: false, state: null }` outside `__DEV__`, so both
  // branches are unreachable no-ops in a release build.
  useEffect(() => {
    if (fidelityPreview.state === 'search') list.setSearchInput(FIDELITY_SEARCH_TERM);
    if (fidelityPreview.state === 'empty') list.setSearchInput(FIDELITY_EMPTY_TERM);
    // Runs once, at mount, to seed the preview deep link's initial state — not a reactive effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToMovement = useCallback(
    (transactionId: string) => router.push(`/transactions/${transactionId}`),
    [router],
  );

  const state = list.state;

  const entries = useMemo<TransactionListEntry[]>(() => {
    if (state.status !== 'ready') return [];
    return buildListEntries(
      state.rows,
      state.monthCounts,
      locale,
      list.committedSearchTerm === '' ? null : list.committedSearchTerm,
    );
  }, [state, list.committedSearchTerm, locale]);

  const resultCount = state.status === 'ready' ? state.rows.length : 0;
  const screenState = resolveTransactionsState({
    filterSheetOpen,
    searchTerm: list.committedSearchTerm,
    resultCount,
  });

  // Assumption A15: while the database is bootstrapping, the screen renders nothing; a bootstrap
  // failure is re-thrown during render by useTransactionsList, reaching the route's ErrorBoundary.
  if (state.status !== 'ready') return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('transactions')}
    >
      <ScreenHeader
        avatar={HEADER_AVATAR_GLYPH}
        title={t('transactions.header_title')}
        subtitle={t('transactions.header_subtitle')}
        action={{
          icon: HEADER_FILTERS_GLYPH,
          accessibilityLabel: t('transactions.header_filters_action'),
          onPress: () => setFilterSheetOpen(true),
          variant: 'brand',
          dot: !isDefaultFilters(list.filters),
        }}
      />

      <View
        style={{
          paddingHorizontal: theme.space['5'],
          paddingVertical: theme.space['3'],
          backgroundColor: theme.colors.surface1,
          borderBottomWidth: componentMetrics.borderWidth.hairline,
          borderBottomColor: theme.colors.border,
        }}
      >
        <TransactionsSearchBar value={list.searchInput} onChangeText={list.setSearchInput} />
      </View>

      {screenState === 'empty' ? (
        <TransactionsEmptyState />
      ) : (
        <FlashList
          data={entries}
          keyExtractor={(entry, index) => (entry.kind === 'movement' ? entry.row.id : `${entry.kind}-${index}`)}
          getItemType={(entry) => getEntryType(entry)}
          renderItem={({ item }) => {
            if (item.kind === 'month-header') return <MonthHeader label={item.label} count={item.count} />;
            if (item.kind === 'search-summary') return <SearchSummary term={item.term} count={item.count} />;
            return <MovementRow row={item.row} locale={locale} onPress={goToMovement} />;
          }}
          contentContainerStyle={{
            paddingHorizontal: theme.space['5'],
            paddingBottom: theme.space['8'],
          }}
          onEndReached={list.loadNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            screenState === 'list' ? (
              <Button
                variant="outline"
                label={t('transactions.manual_entry_button')}
                onPress={() => setManualEntryOpen(true)}
              />
            ) : null
          }
        />
      )}

      <TransactionsFilterSheet
        visible={filterSheetOpen}
        activeFilters={list.filters}
        products={state.products}
        onApply={list.applyFilters}
        onDismiss={() => setFilterSheetOpen(false)}
      />

      <ManualTransactionSheet
        visible={manualEntryOpen}
        products={state.products}
        onSubmit={list.submitManualEntry}
        onDismiss={() => setManualEntryOpen(false)}
      />
    </SafeAreaView>
  );
}

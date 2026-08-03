import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextField } from '../../src/components/ui';
import type { PickerInstitution } from '../../src/db/types';
import { BankPickerResults } from '../../src/features/connect-bank/components/BankPickerResults';
import { FlowHeader } from '../../src/features/connect-bank/components/FlowHeader';
import { chooseInstitution } from '../../src/features/connect-bank/connect-flow-store';
import { resolveBackHref } from '../../src/features/connect-bank/flow-navigation';
import { useConnectFlow } from '../../src/features/connect-bank/use-connect-flow';
import { useInstitutions } from '../../src/features/connect-bank/use-institutions';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

/** Decorative glyph, not user-facing copy (search field leading icon). */
const SEARCH_GLYPH = '🔍';

/**
 * `#screen=bank-picker` (`list`, `search`, `no-results`) — implementation plan Implementation
 * Order step 9. Composition-only: reads the catalogue and the flow's entry origin, and delegates
 * every state's rendering to `BankPickerResults` (Business Rules 8-10).
 */
export default function BankPicker() {
  const { t } = useTranslation();
  const router = useRouter();
  const { entryOrigin } = useConnectFlow();
  const institutionsState = useInstitutions();
  const [query, setQuery] = useState('');

  const institutions = institutionsState.status === 'ready' ? institutionsState.institutions : [];

  function goBack(): void {
    router.push(resolveBackHref(entryOrigin) as never);
  }

  function selectInstitution(institution: PickerInstitution): void {
    if (institution.scraperStatus !== 'available') return;
    chooseInstitution(institution.id);
    router.push('/(onboarding)/bank-credentials');
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['bottom']}
      testID={fidelityTestId('bank-picker')}
    >
      <FlowHeader
        title={t('connect_picker.topbar_title')}
        backAccessibilityLabel={t('connect_picker.back_label')}
        onBack={goBack}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['10'] }}
      >
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('connect_picker.search_placeholder')}
          icon={<Text>{SEARCH_GLYPH}</Text>}
          accessibilityLabel={t('connect_picker.search_accessibility_label')}
        />
        <View style={{ marginTop: theme.space['4'] }}>
          <BankPickerResults
            institutions={institutions}
            query={query}
            onSelectInstitution={selectInstitution}
            copy={{
              listHeading: t('connect_picker.list_heading'),
              resultCount: (count) => t('connect_picker.result_count', { count }),
              availableSubLabel: t('connect_picker.available_sub_label'),
              comingSoonLabel: t('connect_picker.coming_soon_label'),
              availableBadge: t('connect_picker.available_badge'),
              noResultsHeading: t('connect_picker.no_results_heading'),
              noResultsBody: t('connect_picker.no_results_body'),
              standingNote: t('connect_picker.standing_note'),
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

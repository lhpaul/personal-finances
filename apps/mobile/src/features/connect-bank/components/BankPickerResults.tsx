import { View } from 'react-native';

import { Badge, BankRow, EmptyState, Note, Text } from '../../../components/ui';
import type { PickerInstitution } from '../../../db/types';
import { theme } from '../../../theme';
import { matchInstitutions } from '../institution-search';

/** Decorative glyphs, not user-facing copy (implementation plan Decision 10 precedent). */
const NO_RESULTS_GLYPH = '🔎';
const NOTE_GLYPH = 'ℹ️';

const MONOGRAM_LENGTH = 3;

function monogramFor(institution: PickerInstitution): string {
  return institution.shortName ?? institution.name.slice(0, MONOGRAM_LENGTH).toUpperCase();
}

/** Every visible string, pre-resolved by the caller — this component calls no hook (not even
 * `useTranslation`), so it stays directly callable for a renderer-free element-tree assertion
 * (Decision 8 precedent, `component-style-regressions.test.ts`). `resultCount` is a function
 * rather than a resolved string because it needs `{{count}}` re-resolved per render. */
export interface BankPickerCopy {
  listHeading: string;
  resultCount: (count: number) => string;
  availableSubLabel: string;
  comingSoonLabel: string;
  availableBadge: string;
  noResultsHeading: string;
  noResultsBody: string;
  standingNote: string;
}

export interface BankPickerResultsProps {
  /** Already sorted (available first, then by name — `sortForPicker`, Business Rule 10). */
  institutions: PickerInstitution[];
  query: string;
  onSelectInstitution: (institution: PickerInstitution) => void;
  copy: BankPickerCopy;
}

/**
 * `bank-picker`'s `list` / `search` / `no-results` body (implementation plan Testing Strategy
 * scenario 8) — pure presentational, so it is directly callable and its returned element tree
 * inspectable without a renderer. Which state renders is derived from the **raw query text**,
 * never from the match count (spec UX Rules `bank-picker`): an empty (after trim) query is
 * always `list`.
 */
export function BankPickerResults({ institutions, query, onSelectInstitution, copy }: BankPickerResultsProps) {
  const isSearching = query.trim() !== '';
  const results = matchInstitutions(institutions, query);

  if (isSearching && results.length === 0) {
    return <EmptyState icon={NO_RESULTS_GLYPH} title={copy.noResultsHeading} description={copy.noResultsBody} />;
  }

  const list = isSearching ? results : institutions;
  const heading = isSearching ? copy.resultCount(results.length) : copy.listHeading;

  return (
    <View>
      <Text variant="small">{heading}</Text>
      <View style={{ marginTop: theme.space['3'], gap: theme.space['2'] }}>
        {list.map((institution) => {
          const isAvailable = institution.scraperStatus === 'available';
          return (
            <BankRow
              key={institution.id}
              monogram={monogramFor(institution)}
              monogramColor={institution.brandColor ?? theme.colors.brandPrimary}
              name={institution.name}
              subLabel={isAvailable ? copy.availableSubLabel : copy.comingSoonLabel}
              onPress={isAvailable ? () => onSelectInstitution(institution) : undefined}
              unavailableLabel={isAvailable ? undefined : copy.comingSoonLabel}
              trailingAccessory={isAvailable ? <Badge tone="ok" label={copy.availableBadge} /> : undefined}
            />
          );
        })}
      </View>
      <View style={{ marginTop: theme.space['5'] }}>
        <Note tone="info" icon={NOTE_GLYPH}>
          {copy.standingNote}
        </Note>
      </View>
    </View>
  );
}

import { View } from 'react-native';

import { Badge, BankRow, Text } from '../../../components/ui';
import type { ConnectedBankSummary } from '../../../db/types';
import { theme } from '../../../theme';

/** Decorative glyphs/punctuation, not user-facing copy (implementation plan Decision 10
 * precedent — mirrors `ready.tsx`'s `REMINDER_DAY_SEPARATOR`). */
const SUCCESS_MARK_GLYPH = '✓';
const COUNT_SEPARATOR = ' · ';

const MONOGRAM_LENGTH = 3;

function monogramFor(connection: ConnectedBankSummary): string {
  return connection.institutionShortName ?? connection.institutionName.slice(0, MONOGRAM_LENGTH).toUpperCase();
}

/** Every visible string, pre-resolved by the caller — this component calls no hook, so it stays
 * directly callable for a renderer-free element-tree assertion. */
export interface ConnectedBankSummaryCopy {
  headingSingle: string;
  headingMultiple: string;
  congratulation: string;
  productsCount: (count: number) => string;
  movementsCount: (count: number) => string;
}

export interface ConnectedBankSummaryListProps {
  connections: ConnectedBankSummary[];
  copy: ConnectedBankSummaryCopy;
}

/**
 * `bank-connected`'s `single` / `multiple` row list (implementation plan Testing Strategy
 * scenario 11) — pure presentational, directly callable for a renderer-free element-tree
 * assertion. Only the heading and the number of rows differ between the two states (spec UX
 * Rules `bank-connected`); neither state shows anything about categorization or amounts.
 */
export function ConnectedBankSummaryList({ connections, copy }: ConnectedBankSummaryListProps) {
  const isMultiple = connections.length > 1;

  return (
    <View>
      <Text variant="h2" center>
        {isMultiple ? copy.headingMultiple : copy.headingSingle}
      </Text>
      <Text variant="body" center style={{ marginTop: theme.space['2'] }}>
        {copy.congratulation}
      </Text>

      <View style={{ marginTop: theme.space['6'], gap: theme.space['2'] }}>
        {connections.map((connection) => (
          <BankRow
            key={connection.id}
            monogram={monogramFor(connection)}
            monogramColor={connection.institutionBrandColor ?? theme.colors.brandPrimary}
            name={connection.institutionName}
            subLabel={
              copy.productsCount(connection.productCount) +
              COUNT_SEPARATOR +
              copy.movementsCount(connection.movementCount)
            }
            trailingAccessory={<Badge tone="ok" label={SUCCESS_MARK_GLYPH} />}
          />
        ))}
      </View>
    </View>
  );
}

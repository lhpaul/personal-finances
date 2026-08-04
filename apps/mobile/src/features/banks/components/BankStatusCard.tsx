import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Card, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import type { SupportedLocale } from '../../../db/labels';
import type { BankConnectionSummary } from '../../../db/types';
import { theme } from '../../../theme';
import { monogramFor, resolveReviewHeaderFragment } from '../connection-view';
import { translateFragment } from '../translate-fragment';
import type { BankReviewState } from '../types';

/** `.mu-bank__logo`'s header-card override (`width:48px;height:48px;font-size:var(--base)`,
 * `design/mockups/mobile/index.html`) — distinct from `BankRow`'s own row-sized logo, so this
 * header card builds its own monogram badge rather than reusing `BankRow`. */
const LOGO_SIZE = 48;

export interface BankStatusCardProps {
  connection: BankConnectionSummary;
  state: BankReviewState;
  now: Date;
  locale: SupportedLocale;
}

/**
 * `bank-review`'s header card: logo, name, sub-line, badge (implementation plan for issue #20,
 * Decision 9). The sub-line always reads `last_success_at` — relative for `ok`, absolute for
 * `error` — never the last attempt time, so a failed later sync never moves it (brief AC1).
 */
export function BankStatusCard({ connection, state, now, locale }: BankStatusCardProps) {
  const { t } = useTranslation();
  const headerFragment = resolveReviewHeaderFragment(connection.lastSuccessAt, now, locale, state);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
        <View
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            borderRadius: theme.radius.md,
            backgroundColor: connection.brandColor ?? theme.colors.brandPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            tone="inverse"
            style={{ fontSize: theme.typography.size.base, fontWeight: fontWeight(theme.typography.weight.extrabold) }}
          >
            {monogramFor(connection)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3">{connection.name}</Text>
          <Text variant="small" tone="secondary" style={{ marginTop: theme.space['1'] }}>
            {translateFragment(t, headerFragment)}
          </Text>
        </View>
        <Badge
          tone={state === 'ok' ? 'ok' : 'danger'}
          label={t(state === 'ok' ? 'bank_review.badge_ok' : 'bank_review.badge_error')}
        />
      </View>
    </Card>
  );
}

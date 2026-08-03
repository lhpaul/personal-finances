import { formatShortDate } from '@finanzas/shared-utils';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { BankRow, Badge, Card } from '../../../components/ui';
import type { SupportedLocale } from '../../../db/labels';
import type { BankConnection } from '../../../db/types';
import { theme } from '../../../theme';
import { describeSyncTime } from '../relative-time';

const MONOGRAM_LENGTH = 3;

/** `assets.logo` (Assumption A13) is never a real loadable image in this MVP (no bundled bank
 * logos, no `<Image>` precedent anywhere in `apps/mobile`) — every connection renders its
 * monogram, matching what the mockup itself draws for every bank badge on the page. */
function monogramFor(connection: BankConnection): string {
  if (connection.institutionShortName !== undefined) return connection.institutionShortName;
  return connection.institutionName.slice(0, MONOGRAM_LENGTH).toUpperCase();
}

/** `BankRow`'s sub-label for a healthy connection ("Sincronizado hace 2 h", Assumption A11).
 * Every branch calls `t` with a literal key (never a variable key), matching item #8's
 * `ready.tsx` precedent — this is what lets a static catalogue-key scan verify every key. */
function bankSyncLabel(t: TFunction, lastSyncAt: string, now: Date, locale: SupportedLocale): string {
  const descriptor = describeSyncTime(now, lastSyncAt);
  switch (descriptor.kind) {
    case 'minutes':
      return t('home.bank_sync_minutes', { minutes: descriptor.minutes });
    case 'hours':
      return t('home.bank_sync_hours', { hours: descriptor.hours });
    case 'yesterday':
      return t('home.bank_sync_yesterday', { time: descriptor.timeOfDay });
    case 'date':
      return t('home.bank_sync_date', { date: formatShortDate(descriptor.dateLocal, locale) });
  }
}

export interface ConnectedBanksCardProps {
  connections: BankConnection[];
  now: Date;
  locale: SupportedLocale;
  onPressBank: (connectionId: string) => void;
}

/** "Bancos conectados" (implementation plan Decision 4 inputs, Assumption A11, A13). */
export function ConnectedBanksCard({ connections, now, locale, onPressBank }: ConnectedBanksCardProps) {
  const { t } = useTranslation();
  const hasError = connections.some((connection) => connection.syncStatus === 'error');

  return (
    <Card
      title={t('home.banks_title')}
      headerRight={
        hasError ? (
          <Badge tone="danger" label={t('home.banks_badge_error')} />
        ) : (
          <Badge tone="ok" label={t('home.banks_badge_ok')} />
        )
      }
    >
      <View style={{ gap: theme.space['2'] }}>
        {connections.map((connection) => {
          const isError = connection.syncStatus === 'error';
          // `syncStatus: 'idle'` with `lastSyncAt: null` is a valid, non-error first-sync-pending
          // state (found in review) — reserve the danger tone and error copy for a genuine
          // `syncStatus === 'error'`, not for "hasn't synced yet".
          const subLabel = isError
            ? t('home.banks_sub_error')
            : connection.lastSyncAt === null
              ? t('home.banks_sub_pending_first_sync')
              : bankSyncLabel(t, connection.lastSyncAt, now, locale);

          return (
            <BankRow
              key={connection.id}
              monogram={monogramFor(connection)}
              monogramColor={connection.institutionBrandColor ?? theme.colors.brandPrimary}
              name={connection.institutionName}
              subLabel={subLabel}
              subLabelTone={isError ? 'danger' : 'default'}
              onPress={() => onPressBank(connection.id)}
            />
          );
        })}
      </View>
    </Card>
  );
}

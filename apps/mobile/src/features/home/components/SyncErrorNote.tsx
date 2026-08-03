import { formatShortDate } from '@finanzas/shared-utils';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Note, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import type { SupportedLocale } from '../../../db/labels';
import { theme } from '../../../theme';
import type { SyncTimeDescriptor } from '../relative-time';

/** Decorative glyph, not user-facing copy (Decision 10). */
const WARNING_ICON = '⚠️';

export interface SyncErrorNoteProps {
  bankName: string;
  lastSuccessDescriptor: SyncTimeDescriptor | undefined;
  locale: SupportedLocale;
  onRetry: () => void;
}

/** The note's second line ("Último sync exitoso: ayer 21:14.", issue #20 AC1). Every branch
 * calls `t` with a literal key, matching item #8's `ready.tsx` precedent. */
function lastSuccessLabel(t: TFunction, descriptor: SyncTimeDescriptor, locale: SupportedLocale): string {
  switch (descriptor.kind) {
    case 'minutes':
      return t('home.sync_error_last_success_minutes', { minutes: descriptor.minutes });
    case 'hours':
      return t('home.sync_error_last_success_hours', { hours: descriptor.hours });
    case 'yesterday':
      return t('home.sync_error_last_success_yesterday', { time: descriptor.timeOfDay });
    case 'date':
      return t('home.sync_error_last_success_date', {
        date: formatShortDate(descriptor.dateLocal, locale),
      });
  }
}

/**
 * `#screen=home&state=sync-error`'s danger note (implementation plan Decision 13, brief runbook
 * Step 5 — bank name and timestamp are real connection values, not the mockup's literals).
 * "Reintentar" navigates to the failed bank's review route rather than triggering a sync — home
 * owns no sync trigger.
 *
 * "Reintentar" renders through `Note`'s `action` prop — a separate sibling `Pressable`, not text
 * nested inside the note body's single `Text` element (found in review): a nested pressable
 * `Text` is not reliably focusable by assistive technology and has no minimum touch target.
 */
export function SyncErrorNote({
  bankName,
  lastSuccessDescriptor,
  locale,
  onRetry,
}: SyncErrorNoteProps) {
  const { t } = useTranslation();

  return (
    <Note
      tone="danger"
      icon={WARNING_ICON}
      action={{ label: t('home.sync_error_retry'), onPress: onRetry }}
    >
      <Text
        variant="small"
        tone="primary"
        style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}
      >
        {t('home.sync_error_note', { bankName })}
      </Text>
      {lastSuccessDescriptor !== undefined && (
        <>
          {'\n'}
          <Text variant="small" tone="primary">
            {lastSuccessLabel(t, lastSuccessDescriptor, locale)}
          </Text>
        </>
      )}
    </Note>
  );
}

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Card, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.space['3'],
      }}
    >
      <Text variant="small">{label}</Text>
      {children}
    </View>
  );
}

function InfoValue({ children }: { children: ReactNode }) {
  return (
    <Text variant="small" style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}>
      {children}
    </Text>
  );
}

export interface DetailInfoCardProps {
  /** Already resolved — the merchant's name, or `transaction_detail.info_missing` when none
   * resolved (Decision 8, Assumption A6). */
  merchantLabel: string;
  dateLabel: string;
  timeLabel: string;
  productLabel: string;
  /** `undefined` when the movement has no category — the *Categoría* row then shows the
   * "Sin categorizar" badge instead (Decision 4: this row is driven by data, not by state). */
  categoryEmoji: string | undefined;
  categoryName: string | undefined;
  showAutoSuggestionCaption: boolean;
  rawDescription: string;
  /** The note field, composed by the caller (`TransactionDetailScreen`) so it stays a separate,
   * independently testable component (`DetailNoteField`) while rendering inside this same visual
   * card, matching the mockup's single "Información" card. */
  children?: ReactNode;
}

/**
 * `#screen=transaction-detail`'s "Información" card: the five info rows, the auto-suggestion
 * caption (AC2), and the bank's own immutable description in a flat monospaced block (AC1)
 * (implementation plan Decision 3, Decision 4, Layer-by-Layer). Presentational; the screen
 * resolves every value.
 */
export function DetailInfoCard({
  merchantLabel,
  dateLabel,
  timeLabel,
  productLabel,
  categoryEmoji,
  categoryName,
  showAutoSuggestionCaption,
  rawDescription,
  children,
}: DetailInfoCardProps) {
  const { t } = useTranslation();

  return (
    <Card title={t('transaction_detail.info_title')}>
      <InfoRow label={t('transaction_detail.info_merchant')}>
        <InfoValue>{merchantLabel}</InfoValue>
      </InfoRow>
      <InfoRow label={t('transaction_detail.info_date')}>
        <InfoValue>{dateLabel}</InfoValue>
      </InfoRow>
      <InfoRow label={t('transaction_detail.info_time')}>
        <InfoValue>{timeLabel}</InfoValue>
      </InfoRow>
      <InfoRow label={t('transaction_detail.info_product')}>
        <InfoValue>{productLabel}</InfoValue>
      </InfoRow>
      <InfoRow label={t('transaction_detail.info_category')}>
        {categoryEmoji !== undefined && categoryName !== undefined ? (
          <InfoValue>{t('transaction_detail.category_value', { emoji: categoryEmoji, name: categoryName })}</InfoValue>
        ) : (
          <Badge tone="warn" label={t('transaction_detail.uncategorized_badge')} />
        )}
      </InfoRow>
      {showAutoSuggestionCaption && (
        <Text variant="xs" style={{ marginTop: theme.space['1'] }}>
          {t('transaction_detail.auto_suggested')}
        </Text>
      )}

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transaction_detail.description_label')}</Text>
        <Card variant="flat">
          <Text variant="mono">{rawDescription}</Text>
        </Card>
      </View>

      {children}
    </Card>
  );
}

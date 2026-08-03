import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Radio, Sheet, Text, TextField } from '../../../components/ui';
import { theme } from '../../../theme';
import type { StageExclusionReason } from '../use-stage-actions';

const REASONS: StageExclusionReason[] = [
  'personal_transfer',
  'shared_expense',
  'not_relevant',
  'cash_withdrawal',
  'other',
];

/**
 * Every branch calls the translation function with a literal key argument, never a variable key
 * — the pattern `ready.tsx`'s `translateReminderDayKey` already established in this codebase.
 * This is what lets the static catalogue-key scan (`copy-contract.test.ts`) verify every key
 * against the catalogue, and what `i18next.d.ts`'s compile-time key union requires.
 */
function reasonLabel(t: ReturnType<typeof useTranslation>['t'], reason: StageExclusionReason): string {
  switch (reason) {
    case 'personal_transfer':
      return t('categorize.exclude_reason_personal_transfer');
    case 'shared_expense':
      return t('categorize.exclude_reason_shared_expense');
    case 'not_relevant':
      return t('categorize.exclude_reason_not_relevant');
    case 'cash_withdrawal':
      return t('categorize.exclude_reason_cash_withdrawal');
    case 'other':
      return t('categorize.exclude_reason_other');
  }
}

/** Spec AC17: "one pre-selected" — the mockup draws the first radio `is-on`. */
const DEFAULT_REASON: StageExclusionReason = 'personal_transfer';

export interface ExcludeSheetProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: StageExclusionReason; note: string }) => void;
}

/**
 * The exclusion sheet (spec Use Case 5, UX Rules → `exclude-sheet`, AC17-AC19). Cancel and
 * confirm are handled by the caller; this component only reports the chosen reason and the raw
 * (untrimmed) note text — trimming to `null` on blank happens in `excludeTransaction`.
 */
export function ExcludeSheet({ visible, onCancel, onConfirm }: ExcludeSheetProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<StageExclusionReason>(DEFAULT_REASON);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(DEFAULT_REASON);
      setNote('');
    }
  }, [visible]);

  return (
    <Sheet visible={visible} onRequestClose={onCancel}>
      <Text variant="h3">{t('categorize.exclude_sheet_title')}</Text>
      <Text variant="body" style={{ marginTop: theme.space['2'] }}>
        {t('categorize.exclude_sheet_question')}
      </Text>

      <View style={{ marginTop: theme.space['4'] }}>
        {REASONS.map((candidate) => (
          <Pressable
            key={candidate}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === candidate }}
            onPress={() => setReason(candidate)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space['3'],
              paddingVertical: theme.space['3'],
            }}
          >
            <Radio selected={reason === candidate} accessibilityLabel={reasonLabel(t, candidate)} />
            <Text variant="body">{reasonLabel(t, candidate)}</Text>
          </Pressable>
        ))}
      </View>

      <TextField
        value={note}
        onChangeText={setNote}
        placeholder={t('categorize.exclude_note_placeholder')}
      />

      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" label={t('categorize.exclude_cancel')} onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="danger"
            label={t('categorize.exclude_confirm')}
            onPress={() => onConfirm({ reason, note })}
          />
        </View>
      </View>
    </Sheet>
  );
}

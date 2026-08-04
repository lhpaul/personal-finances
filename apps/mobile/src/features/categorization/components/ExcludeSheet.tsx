import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TFunction } from 'i18next';
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
 *
 * Takes `t: TFunction`, not `ReturnType<typeof useTranslation>['t']` (found in review, item #21 —
 * see AGENTS.md's troubleshooting entry for the `TS2589` this avoids).
 */
function reasonLabel(t: TFunction, reason: StageExclusionReason): string {
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

export interface ExcludeSheetProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: StageExclusionReason; note: string }) => void;
  /** Defaults to all five reasons — #13's own drawing. `transaction-detail` (#16) passes its own
   * four (implementation plan Decision 5); the pre-selected radio is always `reasons[0]`, so a
   * caller's own ordering decides the default, not a hardcoded value. */
  reasons?: readonly StageExclusionReason[];
  /** Defaults to `true` — #13 draws the optional note field. `transaction-detail` (#16) passes
   * `false`: its sheet draws no note field, and `onConfirm`'s `note` stays `''` in that case
   * (Decision 5) — the caller decides whether to persist it. */
  showNote?: boolean;
}

/**
 * The exclusion sheet (spec Use Case 5, UX Rules → `exclude-sheet`, AC17-AC19). Cancel and
 * confirm are handled by the caller; this component only reports the chosen reason and the raw
 * (untrimmed) note text — trimming to `null` on blank happens in `excludeTransaction`.
 *
 * `reasons` and `showNote` are additive (implementation plan for issue #16, Decision 5): both
 * default to this component's original behaviour, so #13's own call site
 * (`CategorizeScreen.tsx`) is unchanged and untouched by this edit.
 */
export function ExcludeSheet({
  visible,
  onCancel,
  onConfirm,
  reasons = REASONS,
  showNote = true,
}: ExcludeSheetProps) {
  const { t } = useTranslation();
  const defaultReason = reasons[0] ?? REASONS[0] ?? 'other';
  const [reason, setReason] = useState<StageExclusionReason>(defaultReason);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(defaultReason);
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `defaultReason` is derived from `reasons`, a prop that is stable across a single sheet's lifetime in every known caller; re-running this reset on every `reasons` identity change would re-arm the default reason mid-interaction.
  }, [visible]);

  return (
    <Sheet visible={visible} onRequestClose={onCancel}>
      <Text variant="h3">{t('categorize.exclude_sheet_title')}</Text>
      <Text variant="body" style={{ marginTop: theme.space['2'] }}>
        {t('categorize.exclude_sheet_question')}
      </Text>

      <View style={{ marginTop: theme.space['4'] }}>
        {reasons.map((candidate) => (
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

      {showNote && (
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder={t('categorize.exclude_note_placeholder')}
        />
      )}

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

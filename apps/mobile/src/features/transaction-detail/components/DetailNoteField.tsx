import { useTranslation } from 'react-i18next';

import { TextField } from '../../../components/ui';

export interface DetailNoteFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Fires on blur (Decision 9) — the caller decides whether the trimmed draft actually differs
   * from the stored value before issuing a write. */
  onBlur: () => void;
}

/**
 * `#screen=transaction-detail`'s *Nota* field — a thin wrapper over the shared `TextField`
 * (`.mu-field`, `.mu-input`, `.mu-input--ph` — all `TextField`-owned in `MU_CLASS_MAP`), adding
 * only the catalogue label/placeholder and the `onBlur` seam this screen's save-on-blur
 * behaviour needs (implementation plan Decision 9, Assumption A8).
 */
export function DetailNoteField({ value, onChangeText, onBlur }: DetailNoteFieldProps) {
  const { t } = useTranslation();

  return (
    <TextField
      label={t('transaction_detail.note_label')}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={t('transaction_detail.note_placeholder')}
    />
  );
}

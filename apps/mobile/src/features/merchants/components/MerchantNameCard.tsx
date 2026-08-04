import { useTranslation } from 'react-i18next';

import { Card, TextField } from '../../../components/ui';

export interface MerchantNameCardProps {
  name: string;
  onChangeName: (name: string) => void;
}

/**
 * The "Nombre del comercio" card (implementation plan Layer-by-Layer). Renders in every state —
 * the mockup draws no `data-states` on it. Renaming only persists on the bottom "Guardar"
 * (Decision 4); this component only reports keystrokes.
 */
export function MerchantNameCard({ name, onChangeName }: MerchantNameCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <TextField
        label={t('merchant.edit.name_label')}
        value={name}
        onChangeText={onChangeName}
        hint={t('merchant.edit.name_hint')}
      />
    </Card>
  );
}

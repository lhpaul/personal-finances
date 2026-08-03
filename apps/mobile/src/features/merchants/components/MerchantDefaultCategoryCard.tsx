import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import type { Category } from '../../../db/types';
import { screenMetrics, theme } from '../../../theme';

export interface MerchantDefaultCategoryCardProps {
  /** `undefined` when the merchant has no default category set (Assumption A6-adjacent — the
   * mockup draws no empty variant for this card, but a merchant can genuinely have none). */
  category: Category | undefined;
  onChangePress: () => void;
}

/**
 * "Categoría por defecto" (implementation plan Layer-by-Layer, brief Scope, AC2). States
 * `default` and `suggestions`. "Cambiar" only navigates to the picker (Decision 4) — nothing is
 * written until the bottom "Guardar".
 */
export function MerchantDefaultCategoryCard({ category, onChangePress }: MerchantDefaultCategoryCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      title={t('merchant.edit.default_category_title')}
      headerRight={
        <Button
          variant="outline"
          size="sm"
          label={t('merchant.edit.default_category_change')}
          onPress={onChangePress}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
        <View
          style={{
            width: screenMetrics.merchants.itemIconSize,
            height: screenMetrics.merchants.itemIconSize,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.infoBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: screenMetrics.merchants.itemIconGlyphSize }}>{category?.emoji ?? ''}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: screenMetrics.merchants.itemTitleFontSize,
              fontWeight: fontWeight(theme.typography.weight.semibold),
            }}
          >
            {category ? category.name : t('merchant.edit.default_category_none')}
          </Text>
          <Text variant="small" style={{ marginTop: screenMetrics.merchants.itemSubMarginTop }}>
            {t('merchant.edit.default_category_sub')}
          </Text>
        </View>
      </View>
    </Card>
  );
}

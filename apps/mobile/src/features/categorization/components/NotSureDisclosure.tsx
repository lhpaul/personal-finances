import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../../../components/ui';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

/** Decorative disclosure glyph — see `StageTopBar`'s `BACK_GLYPH` precedent. */
const CHEVRON_GLYPH = '▾';

export interface NotSureDisclosureProps {
  open: boolean;
  onToggle: () => void;
  onReviewLater: () => void;
  onUncertain: () => void;
  onExclude: () => void;
}

/**
 * "¿No estás seguro?" (spec Use Case 4, UX Rules → Categorization): a disclosure row that reveals
 * exactly three options, none of which is disabled or hides the movement/category grid. A
 * screen-local composition of `mu-list` / `mu-item*` (deferred to #19 in `MU_CLASS_MAP` —
 * implementation plan Decision 13), not a new `components/ui/` primitive.
 */
export function NotSureDisclosure({
  open,
  onToggle,
  onReviewLater,
  onUncertain,
  onExclude,
}: NotSureDisclosureProps) {
  const { t } = useTranslation();

  return (
    <View style={{ marginTop: theme.space['4'] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space['3'],
          padding: theme.space['4'],
          borderRadius: theme.radius.lg,
          borderWidth: componentMetrics.borderWidth.hairline,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        }}
      >
        <Text>{t('categorize.not_sure_icon')}</Text>
        <Text variant="body" style={{ flex: 1 }}>
          {t('categorize.not_sure')}
        </Text>
        <Text style={{ fontSize: screenMetrics.categorization.disclosureChevronSize }}>{CHEVRON_GLYPH}</Text>
      </Pressable>

      {open && (
        <View style={{ marginTop: theme.space['3'] }}>
          <NotSureOptionRow
            icon={t('categorize.review_later_icon')}
            title={t('categorize.review_later_title')}
            subtitle={t('categorize.review_later_sub')}
            onPress={onReviewLater}
          />
          <NotSureOptionRow
            icon={t('categorize.uncertain_icon')}
            title={t('categorize.uncertain_title')}
            subtitle={t('categorize.uncertain_sub')}
            onPress={onUncertain}
          />
          <NotSureOptionRow
            icon={t('categorize.exclude_icon')}
            title={t('categorize.exclude_title')}
            subtitle={t('categorize.exclude_sub')}
            onPress={onExclude}
          />
        </View>
      )}
    </View>
  );
}

function NotSureOptionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['3'],
        paddingVertical: theme.space['3'],
      }}
    >
      <Text>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        <Text variant="small">{subtitle}</Text>
      </View>
    </Pressable>
  );
}

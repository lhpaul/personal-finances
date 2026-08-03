import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Progress } from '../../../components/ui';
import { theme } from '../../../theme';

/** Decorative glyph, not user-facing copy (Decision 10). */
const SPROUT_ICON = '🌱';

/**
 * `#screen=home&state=empty` (implementation plan Decision 10). No progress signal exists in the
 * data model for a first sync in progress, so `Progress`'s `indeterminate` prop animates instead
 * of rendering a fabricated percentage.
 */
export function FirstSyncEmptyState() {
  const { t } = useTranslation();

  return (
    <View>
      <EmptyState icon={SPROUT_ICON} title={t('home.empty_title')} description={t('home.empty_body')} />
      <View style={{ paddingHorizontal: theme.space['5'] }}>
        <Progress indeterminate accessibilityLabel={t('home.empty_progress_label')} />
      </View>
    </View>
  );
}

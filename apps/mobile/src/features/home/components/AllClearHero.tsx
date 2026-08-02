import { useTranslation } from 'react-i18next';

import { Hero } from '../../../components/ui';

/** Decorative glyph, not user-facing copy (Decision 10). */
const ALL_CLEAR_ICON = '✅';

/** `#screen=home&state=all-clear`'s hero. Not a button — the mockup draws no `onclick` on this
 * block (unlike the `pending` challenge hero), so `onPress` is intentionally never wired here. */
export function AllClearHero() {
  const { t } = useTranslation();

  return (
    <Hero
      gradient="income"
      icon={ALL_CLEAR_ICON}
      title={t('home.all_clear_title')}
      subtitle={t('home.all_clear_subtitle')}
    />
  );
}

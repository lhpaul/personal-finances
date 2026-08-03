import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Hero } from '../../../components/ui';

/** Decorative glyph, not user-facing copy (Decision 10, item #2 precedent). */
const CHALLENGE_ICON = '🎯';

/** Placeholder heuristic — no per-movement categorization time has been measured yet (#13 is not
 * implemented). Matches the mockup's one example (4 pending -> ~5 min) and is reversible in this
 * one place; revisit once #13 ships a real estimate. */
const MINUTES_PER_MOVEMENT_ESTIMATE = 1.25;

export interface ChallengeHeroProps {
  uncategorizedCount: number;
}

/** `#screen=home&state=pending`'s challenge hero (implementation plan Decision 4, Decision 13).
 * Navigates to `/categorize/intro` — home owns no categorization logic of its own. */
export function ChallengeHero({ uncategorizedCount }: ChallengeHeroProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const minutes = Math.max(1, Math.round(uncategorizedCount * MINUTES_PER_MOVEMENT_ESTIMATE));

  return (
    <Hero
      gradient="challenge"
      icon={CHALLENGE_ICON}
      title={t('home.challenge_title')}
      subtitle={t('home.challenge_subtitle', { count: uncategorizedCount, minutes })}
      onPress={() => router.push('/categorize/intro')}
    />
  );
}

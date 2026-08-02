import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../../src/components/ui';
import { screenMetrics, theme } from '../../src/theme';

/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues
 * (implementation plan Decision 11). */
const WAVE_GLYPH = '👋';

/**
 * `#screen=onboarding-intro` (implementation plan Implementation Order step 10). Declares no
 * manifest state, so there is exactly one frame to render: glyph, headline, lead paragraph, and
 * a single full-width primary CTA to `onboarding-value`. No back button, no top bar, no skip
 * control — none are drawn in the mockup.
 */
export default function OnboardingIntro() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.space['5'],
          paddingBottom: theme.space['8'],
          justifyContent: 'space-between',
        }}
      >
        <View />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: screenMetrics.onboarding.heroGlyphSize }}>{WAVE_GLYPH}</Text>
          <Text variant="h1" center style={{ marginTop: theme.space['4'] }}>
            {t('onboarding_intro.title')}
          </Text>
          <Text variant="bodyLead" center style={{ marginTop: theme.space['3'] }}>
            {t('onboarding_intro.body')}
          </Text>
        </View>
        <Button label={t('onboarding_intro.cta')} onPress={() => router.push('/(onboarding)/value')} />
      </View>
    </SafeAreaView>
  );
}

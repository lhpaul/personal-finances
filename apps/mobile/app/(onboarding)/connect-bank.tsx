import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '../../src/components/ui';
import { SecurityAccordion } from '../../src/features/connect-bank/components/SecurityAccordion';
import { enterFlow } from '../../src/features/connect-bank/connect-flow-store';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { componentMetrics, theme } from '../../src/theme';

/** Decorative glyphs, not user-facing copy (implementation plan Decision 10 precedent). */
const LOCK_GLYPH = '🔒';
const PHONE_GLYPH = '📱';

/**
 * `#screen=connect-bank-intro` (`default`, `how-it-works`) — implementation plan Implementation
 * Order step 9.
 *
 * Exactly one forward action, per spec Deferral Note 2 — no skip control is drawn. The accordion
 * is local state, not navigation (spec UX Rules `connect-bank-intro`); going back leaves
 * onboarding via the system back gesture, which this screen draws no control for and does not
 * intercept.
 */
export default function ConnectBankIntro() {
  const { t } = useTranslation();
  const router = useRouter();
  const [howItWorksExpanded, setHowItWorksExpanded] = useState(false);

  function goToPicker(): void {
    enterFlow('onboarding');
    router.push('/(onboarding)/bank-picker');
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('connect-bank-intro')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['10'] }}
      >
        <Text variant="eyebrow">{t('connect_intro.eyebrow')}</Text>
        <Text variant="h1" style={{ marginTop: theme.space['2'] }}>
          {t('connect_intro.title')}
        </Text>
        <Text variant="bodyLead" style={{ marginTop: theme.space['3'] }}>
          {t('connect_intro.lead')}
        </Text>

        <View
          style={{
            marginTop: theme.space['5'],
            padding: theme.space['5'],
            borderRadius: theme.radius.card,
            backgroundColor: theme.colors.successBg,
            borderWidth: componentMetrics.borderWidth.hairline,
            borderColor: theme.colors.successBorder,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
            <Text>{LOCK_GLYPH}</Text>
            <Text variant="h3">{t('connect_intro.security_card_title')}</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.space['3'],
              marginTop: theme.space['4'],
            }}
          >
            <Text>{PHONE_GLYPH}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: theme.typography.size.base }}>
                {t('connect_intro.security_card_subtitle')}
              </Text>
              <Text variant="small" style={{ marginTop: theme.space['1'] }}>
                {t('connect_intro.security_card_body')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: theme.space['4'] }}>
          <SecurityAccordion
            expanded={howItWorksExpanded}
            onToggle={() => setHowItWorksExpanded((prev) => !prev)}
          />
        </View>

        <View style={{ marginTop: theme.space['5'] }}>
          <Button label={t('connect_intro.cta')} onPress={goToPicker} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

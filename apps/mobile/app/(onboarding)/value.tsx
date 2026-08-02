import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Dots } from '../../src/components/ui';
import { ValueStepPage } from '../../src/features/onboarding/components/ValueStepPage';
import {
  LOCK_GLYPH,
  SPROUT_GLYPH,
  TARGET_GLYPH,
  VALUE_STEPS,
  nextStepIndex,
  stepIndexFromScrollOffset,
} from '../../src/features/onboarding/value-steps';
import { theme } from '../../src/theme';

/**
 * `#screen=onboarding-value&state=step-1|step-2|step-3` (implementation plan Decision 3,
 * Decision 4; spec AC3). A paged horizontal `ScrollView` whose three pages are exactly the
 * manifest's declared states — `VALUE_STEPS` fixes the mapping and
 * `value-steps-manifest-parity.test.ts` asserts it (non-negotiable 6). Advances by swipe or by
 * the `Continuar` CTA (Assumption A7); "Saltar" is drawn on every step and reaches the same
 * `/(onboarding)/connect-bank` destination as the step-3 CTA, without marking onboarding
 * complete (Decision 3) — only `useCompleteOnboarding` on `onboarding-ready` ever writes that
 * flag (Decision 5).
 *
 * Every translation call below uses a literal catalogue key (never a variable key) so
 * `onboarding-catalogue-keys.test.ts`'s static scan can verify it against the catalogue —
 * `VALUE_STEPS` supplies only the stable `stateId`/`glyph` pair, not the copy itself.
 */
export default function OnboardingValue() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const total = VALUE_STEPS.length;
  const isLastStep = index === total - 1;

  // Glyphs and `stateId`s are read from `VALUE_STEPS` (the single source `value-steps.ts` and
  // its manifest-parity test both key off); the copy below uses literal translation keys so the
  // catalogue-key scan can verify every one against `es.json` statically (Decision 3 doc note
  // above) — `VALUE_STEPS[n].titleKey`/`bodyKey` name which key each step maps to, but are not
  // themselves passed to the translation function dynamically.
  const steps = [
    {
      stateId: 'step-1' as const,
      glyph: TARGET_GLYPH,
      title: t('onboarding_value.step_1_title'),
      body: t('onboarding_value.step_1_body'),
      checklist: [
        t('onboarding_value.step_1_check_1'),
        t('onboarding_value.step_1_check_2'),
        t('onboarding_value.step_1_check_3'),
      ],
    },
    {
      stateId: 'step-2' as const,
      glyph: LOCK_GLYPH,
      title: t('onboarding_value.step_2_title'),
      body: t('onboarding_value.step_2_body'),
    },
    {
      stateId: 'step-3' as const,
      glyph: SPROUT_GLYPH,
      title: t('onboarding_value.step_3_title'),
      body: t('onboarding_value.step_3_body'),
    },
  ];

  function goToConnectBank(): void {
    router.push('/(onboarding)/connect-bank');
  }

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const nextIndex = stepIndexFromScrollOffset(event.nativeEvent.contentOffset.x, width, total);
    setIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  function handleContinue(): void {
    if (isLastStep) {
      goToConnectBank();
      return;
    }
    const target = nextStepIndex(index, total);
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space['5'] }}>
        <View style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          label={t('onboarding_value.skip')}
          onPress={goToConnectBank}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {steps.map((step) => (
          <ValueStepPage
            key={step.stateId}
            width={width}
            glyph={step.glyph}
            title={step.title}
            body={step.body}
            checklist={step.checklist}
          />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: theme.space['5'], paddingBottom: theme.space['8'] }}>
        <Dots total={total} current={index + 1} />
        <View style={{ marginTop: theme.space['5'] }}>
          <Button label={t('onboarding_value.cta')} onPress={handleContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

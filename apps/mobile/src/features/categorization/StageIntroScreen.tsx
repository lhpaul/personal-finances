import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Note, Text } from '../../components/ui';
import { useFidelityPreview } from '../../lib/fidelity-preview';
import { resolveDeviceLocale } from '../../i18n/locale';
import { screenMetrics, theme } from '../../theme';
import { StageTopBar } from './components/StageTopBar';
import { estimateStageMinutes, STAGE_BATCH_SIZE } from './stage-batch';
import { useStageData } from './use-stage-data';

/** Decorative glyphs the mockup draws as content — catalogue values, per Decision 17. */

export interface StageIntroScreenProps {
  /** `fidelityTestId('stage-intro')` — computed and passed down by the route file
   * (`app/categorize/intro.tsx`), not here: the design-fidelity contract's validator requires
   * the literal `fidelityTestId(screenId)` call to appear in the route file it lists as
   * `app_file`, not only somewhere in the feature folder. */
  testID?: string;
}

/**
 * `#screen=stage-intro` (spec Use Case 1, UX Rules → Stage intro; AC1, AC2). No empty state: when
 * nothing is pending, the person is sent to home instead (Assumption A13) — unless a fidelity
 * preview capture is active, which always renders this screen regardless of live data.
 */
export function StageIntroScreen({ testID }: StageIntroScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [locale] = useState(() => resolveDeviceLocale());
  const stageData = useStageData({ locale });
  const preview = useFidelityPreview();

  const pendingCount = stageData.status === 'ready' ? stageData.data.pendingCount : 0;

  useEffect(() => {
    if (preview.active) return;
    if (stageData.status === 'ready' && stageData.data.pendingCount === 0) {
      router.replace('/(tabs)/home');
    }
  }, [preview.active, router, stageData]);

  if (stageData.status !== 'ready') {
    // spec UX Rules → Loading: the screen never shows a half-populated card.
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }

  if (!preview.active && pendingCount === 0) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }

  const minutes = estimateStageMinutes(Math.min(pendingCount, STAGE_BATCH_SIZE) || STAGE_BATCH_SIZE);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={testID}
    >
      <StageTopBar
        title={t('stage_intro.topbar_title')}
        backA11yLabel={t('stage_intro.back_a11y')}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.space['5'], paddingBottom: theme.space['5'] }}
      >
        <View style={{ alignItems: 'center', marginTop: theme.space['5'] }}>
          <Text style={{ fontSize: screenMetrics.categorization.stageIntroHeroGlyphSize }}>
            {t('stage_intro.hero_icon')}
          </Text>
          <Text variant="h1" center style={{ marginTop: theme.space['3'] }}>
            {t('stage_intro.heading')}
          </Text>
          <Text variant="eyebrow" center style={{ marginTop: theme.space['2'] }}>
            {t('stage_intro.eyebrow')}
          </Text>
          <Text variant="body" center style={{ marginTop: theme.space['3'] }}>
            {t('stage_intro.lead')}
          </Text>
        </View>

        <Card>
          <Text variant="h3">{t('stage_intro.what_title')}</Text>
          <Text variant="body" style={{ marginTop: theme.space['2'] }}>
            {t('stage_intro.what_body')}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space['4'] }}>
            <ThreeStepColumn
              icon={t('stage_intro.step_identify_icon')}
              title={t('stage_intro.step_identify_title')}
              subtitle={t('stage_intro.step_identify_sub')}
            />
            <ThreeStepColumn
              icon={t('stage_intro.step_categorize_icon')}
              title={t('stage_intro.step_categorize_title')}
              subtitle={t('stage_intro.step_categorize_sub')}
            />
            <ThreeStepColumn
              icon={t('stage_intro.step_celebrate_icon')}
              title={t('stage_intro.step_celebrate_title')}
              subtitle={t('stage_intro.step_celebrate_sub')}
            />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['4'] }}>
          <View style={{ flex: 1 }}>
            <Card variant="tight">
              <Text variant="h1" tone="brand" center>
                {pendingCount}
              </Text>
              <Text variant="xs" center>
                {t('stage_intro.tile_pending_label')}
              </Text>
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card variant="tight">
              <Text variant="h1" tone="brand" center>
                {t('stage_intro.tile_minutes_value', { minutes })}
              </Text>
              <Text variant="xs" center>
                {t('stage_intro.tile_minutes_label')}
              </Text>
            </Card>
          </View>
        </View>

        <Card>
          <Text variant="h3">{t('stage_intro.why_title')}</Text>
          <WhyRow icon={t('stage_intro.why_check')} title={t('stage_intro.why_visibility_title')} subtitle={t('stage_intro.why_visibility_sub')} />
          <WhyRow icon={t('stage_intro.why_check')} title={t('stage_intro.why_insights_title')} subtitle={t('stage_intro.why_insights_sub')} />
          <WhyRow icon={t('stage_intro.why_check')} title={t('stage_intro.why_control_title')} subtitle={t('stage_intro.why_control_sub')} />
        </Card>

        <View style={{ marginTop: theme.space['4'] }}>
          <Note icon={t('stage_intro.note_icon')}>
            <Text variant="small">
              {t('stage_intro.note_strong')} {t('stage_intro.note_body')}
            </Text>
          </Note>
        </View>

        <View style={{ marginTop: theme.space['5'] }}>
          <Button label={t('stage_intro.start')} onPress={() => router.push('/categorize')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThreeStepColumn({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: screenMetrics.categorization.threeStepIconSize }}>{icon}</Text>
      <Text variant="small" center style={{ marginTop: theme.space['1'] }}>
        {title}
      </Text>
      <Text variant="xs" center>
        {subtitle}
      </Text>
    </View>
  );
}

function WhyRow({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space['3'], marginTop: theme.space['3'] }}>
      <Text tone="brand">{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="small">{title}</Text>
        <Text variant="xs">{subtitle}</Text>
      </View>
    </View>
  );
}

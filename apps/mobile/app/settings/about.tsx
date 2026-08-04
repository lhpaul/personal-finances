import { ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListGroup, ListRow, Note, Text, TopBar } from '../../src/components/ui';
import { fontWeight } from '../../src/components/ui/_internal/font-weight';
import { ABOUT_LINK_ROWS, resolveAppVersion, type AboutLinkRowDescriptor } from '../../src/features/settings/about';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { screenMetrics, theme } from '../../src/theme';

// `TFunction` (i18next's own exported type), not `ReturnType<typeof useTranslation>['t']` (found
// in review: with ~740+ flat catalogue keys, extracting the type this way triggers
// `TS2589: Type instantiation is excessively deep and possibly infinite` at every call site that
// reuses it as a parameter type — see AGENTS.md's troubleshooting entry).
type Translate = TFunction;

/** `ABOUT_LINK_ROWS`' `iconKey`/`titleKey` are catalogue-key *values* (self-documentation and
 * `about.test.ts`'s ordering assertion) — the route resolves each row's copy through this literal
 * switch on `titleKey`, mirroring `app/settings/index.tsx`'s `resolveRowCopy` (i18next's `t()`
 * type only accepts a literal key). */
function resolveLinkRowCopy(t: Translate, row: AboutLinkRowDescriptor): { icon: string; title: string } {
  switch (row.titleKey) {
    case 'settings.about.privacy_policy':
      return { icon: t('settings.about.link_icon_privacy'), title: t('settings.about.privacy_policy') };
    case 'settings.about.terms':
      return { icon: t('settings.about.link_icon_terms'), title: t('settings.about.terms') };
    case 'settings.about.feedback':
      return { icon: t('settings.about.link_icon_feedback'), title: t('settings.about.feedback') };
    default:
      return { icon: '', title: '' };
  }
}

/**
 * `#screen=settings-about` (implementation plan for issue #19, Decisions 8, 9). The three list
 * rows are drawn exactly as the mockup draws them and are inert — no `onPress`, so `ListRow`
 * renders them as non-pressable, `accessibilityState={{ disabled: true }}` rows (Decision 8).
 * The version string is read from `expo-constants`, never the mockup's `1.0.0` literal (Decision
 * 9, Assumption A6).
 */
export default function SettingsAbout() {
  const { t } = useTranslation();
  const router = useRouter();
  const version = resolveAppVersion(Constants);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('settings-about')}
    >
      <TopBar
        title={t('settings.about.title')}
        onBack={() => router.push('/settings')}
        backAccessibilityLabel={t('settings.back_label')}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space['5'],
          paddingTop: theme.space['6'],
          paddingBottom: theme.space['8'],
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: screenMetrics.settings.aboutBrandIconSize,
              height: screenMetrics.settings.aboutBrandIconSize,
              borderRadius: screenMetrics.settings.aboutBrandIconRadius,
              backgroundColor: theme.colors.brandPrimary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: screenMetrics.settings.aboutBrandIconGlyphSize }}>
              {t('settings.about.brand_icon')}
            </Text>
          </View>
          <Text variant="h2" style={{ marginTop: theme.space['4'] }}>
            {t('settings.about.app_name')}
          </Text>
          <Text variant="small">{t('settings.about.version', { version })}</Text>
        </View>

        <View style={{ marginTop: theme.space['6'] }}>
          <Note tone="ok" icon={t('settings.about.privacy_icon')}>
            <Text variant="small" style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}>
              {t('settings.about.privacy_title')}
            </Text>{' '}
            {t('settings.about.privacy_body')}
          </Note>
        </View>

        <View style={{ marginTop: theme.space['5'] }}>
          <ListGroup>
            {ABOUT_LINK_ROWS.map((row) => {
              const copy = resolveLinkRowCopy(t, row);
              return <ListRow key={row.titleKey} icon={copy.icon} title={copy.title} />;
            })}
          </ListGroup>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

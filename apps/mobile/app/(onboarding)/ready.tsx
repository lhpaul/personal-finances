import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatWallClockLabel } from '@finanzas/shared-utils';

import { Button, Card, Text } from '../../src/components/ui';
import { ReadySummaryRow } from '../../src/features/onboarding/components/ReadySummaryRow';
import { REMINDER_DAY_SEPARATOR } from '../../src/features/onboarding/ready-summary';
import { useCompleteOnboarding } from '../../src/features/onboarding/use-complete-onboarding';
import { useOnboardingSummary } from '../../src/features/onboarding/use-onboarding-summary';
import type { ConnectedBanksSummary, ReminderSettings } from '../../src/db/types';
import { summarizeReminderDays, type ReminderDaysSummary } from '../../src/features/reminders/summary';
import { screenMetrics, theme } from '../../src/theme';

/** Decorative glyphs, not user-facing copy (implementation plan Decision 11). */
const CELEBRATION_GLYPH = '🎉';
const BANK_GLYPH = '🏦';
const BELL_GLYPH = '🔔';
const CHECK_BADGE_LABEL = '✓';

/** Not drawn in the mockup — a reasonable separator for a joined list of proper names
 * (Assumption A6). Unreachable in the MVP: the seeded scraper support list ships one
 * `available` bank (Banco de Chile), so `institutionNames.length > 1` cannot occur yet. */
const BANK_NAME_SEPARATOR = ', ';

const EMPTY_BANKS: ConnectedBanksSummary = { connectionCount: 0, institutionNames: [], productCount: 0 };
const DISABLED_REMINDERS: ReminderSettings = { enabled: false, timeOfDay: undefined, days: undefined };

/**
 * Every branch below calls the translation function with a literal key (never a variable key),
 * per Decision 13 ("two explicit keys and a `count === 1` check **in code**") — this is what
 * lets `onboarding-catalogue-keys.test.ts`'s static scan verify every key against the catalogue.
 */
function reminderDaysLabel(
  t: ReturnType<typeof useTranslation>['t'],
  summary: ReminderDaysSummary,
): string {
  switch (summary.kind) {
    case 'weekdays':
      return t('reminders.days_weekdays');
    case 'everyday':
      return t('reminders.days_everyday');
    case 'custom':
      return summary.days
        .map((day) => {
          switch (day) {
            case 1:
              return t('reminders.day_1');
            case 2:
              return t('reminders.day_2');
            case 3:
              return t('reminders.day_3');
            case 4:
              return t('reminders.day_4');
            case 5:
              return t('reminders.day_5');
            case 6:
              return t('reminders.day_6');
            case 7:
              return t('reminders.day_7');
            default:
              return '';
          }
        })
        .filter((label) => label !== '')
        .join(REMINDER_DAY_SEPARATOR);
  }
}

/**
 * `#screen=onboarding-ready` (implementation plan Decision 7, Decision 8; spec AC4, AC5). Renders
 * only the summary rows it can truthfully fill — the mockup draws exactly one variant (one bank
 * connected, reminders on) and the manifest declares no states for this screen, so inventing a
 * "0 bancos" / "notificaciones desactivadas" copy would breach non-negotiable 8 (Assumption A2).
 * Completing onboarding writes `app_settings.onboarding_completed` and replaces the route
 * (`useCompleteOnboarding`, Decision 5) to a data-driven destination (Decision 6).
 */
export default function OnboardingReady() {
  const { t } = useTranslation();
  const summary = useOnboardingSummary();
  const { complete } = useCompleteOnboarding();

  const banks = summary.status === 'ready' ? summary.banks : EMPTY_BANKS;
  const reminders = summary.status === 'ready' ? summary.reminders : DISABLED_REMINDERS;

  const showBanksRow = banks.connectionCount > 0;
  const banksTitle =
    banks.connectionCount === 1
      ? t('onboarding_ready.banks_title_single', { count: banks.connectionCount })
      : t('onboarding_ready.banks_title_plural', { count: banks.connectionCount });
  const banksProducts =
    banks.productCount === 1
      ? t('onboarding_ready.banks_products_single', { count: banks.productCount })
      : t('onboarding_ready.banks_products_plural', { count: banks.productCount });
  const banksSubtitle = t('onboarding_ready.banks_subtitle', {
    names: banks.institutionNames.join(BANK_NAME_SEPARATOR),
    products: banksProducts,
  });

  const showRemindersRow = reminders.enabled === true;
  const remindersSubtitle =
    reminders.timeOfDay !== undefined && reminders.days !== undefined
      ? t('reminders.summary', {
          time: formatWallClockLabel(reminders.timeOfDay),
          days: reminderDaysLabel(t, summarizeReminderDays(reminders.days)),
        })
      : undefined;

  const showCard = showBanksRow || showRemindersRow;

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
        <View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: screenMetrics.onboarding.heroGlyphSize }}>{CELEBRATION_GLYPH}</Text>
            <Text variant="h1" center style={{ marginTop: theme.space['4'] }}>
              {t('onboarding_ready.title')}
            </Text>
            <Text variant="bodyLead" center style={{ marginTop: theme.space['3'] }}>
              {t('onboarding_ready.body')}
            </Text>
          </View>

          {showCard && (
            <View style={{ marginTop: theme.space['6'] }}>
              <Card>
                {showBanksRow && (
                  <ReadySummaryRow
                    glyph={BANK_GLYPH}
                    title={banksTitle}
                    subtitle={banksSubtitle}
                    badgeLabel={CHECK_BADGE_LABEL}
                    isFirst
                  />
                )}
                {showRemindersRow && (
                  <ReadySummaryRow
                    glyph={BELL_GLYPH}
                    title={t('onboarding_ready.reminders_title')}
                    subtitle={remindersSubtitle}
                    badgeLabel={CHECK_BADGE_LABEL}
                    isFirst={!showBanksRow}
                  />
                )}
              </Card>
            </View>
          )}
        </View>
        <Button label={t('onboarding_ready.cta')} onPress={complete} />
      </View>
    </SafeAreaView>
  );
}

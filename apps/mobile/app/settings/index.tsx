import { ScrollView } from 'react-native';
import { formatWallClockLabel } from '@finanzas/shared-utils';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListGroup, ListRow, TopBar } from '../../src/components/ui';
import {
  REMINDER_DAY_SEPARATOR,
  reminderDayKeys,
  reminderDaysKey,
} from '../../src/features/onboarding/ready-summary';
import { summarizeReminderDays } from '../../src/features/reminders/summary';
import {
  accountSubtitle,
  aboutSubtitle,
  banksSubtitle,
  categoriesSubtitle,
  remindersAreFullyConfigured,
  SETTINGS_HUB_ROWS,
  type HubSubtitle,
  type SettingsHubRowDescriptor,
} from '../../src/features/settings/settings-hub';
import { useSettingsHub } from '../../src/features/settings/use-settings-hub';
import { fidelityTestId } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

// `TFunction` (i18next's own exported type), not `ReturnType<typeof useTranslation>['t']` (found
// in review: with ~740+ flat catalogue keys, extracting the type this way triggers
// `TS2589: Type instantiation is excessively deep and possibly infinite` at every call site that
// reuses it as a parameter type — see AGENTS.md's troubleshooting entry).
type Translate = TFunction;

/**
 * Translates a day key exactly the way `app/(onboarding)/ready.tsx` does — a literal `t(...)`
 * call per branch (never a variable key), so a static scan can verify every key against the
 * catalogue.
 */
function translateReminderDayKey(t: Translate, key: string): string {
  switch (key) {
    case 'reminders.day_1':
      return t('reminders.day_1');
    case 'reminders.day_2':
      return t('reminders.day_2');
    case 'reminders.day_3':
      return t('reminders.day_3');
    case 'reminders.day_4':
      return t('reminders.day_4');
    case 'reminders.day_5':
      return t('reminders.day_5');
    case 'reminders.day_6':
      return t('reminders.day_6');
    case 'reminders.day_7':
      return t('reminders.day_7');
    default:
      return '';
  }
}

function reminderDaysLabel(t: Translate, days: number[]): string {
  const summary = summarizeReminderDays(days);
  const key = reminderDaysKey(summary);
  if (key === 'reminders.days_weekdays') return t('reminders.days_weekdays');
  if (key === 'reminders.days_everyday') return t('reminders.days_everyday');
  return summary.kind === 'custom'
    ? reminderDayKeys(summary.days)
        .map((dayKey) => translateReminderDayKey(t, dayKey))
        .join(REMINDER_DAY_SEPARATOR)
    : '';
}

/** Every branch calls `t(...)` with a literal key (never a variable key), mirroring
 * `app/(onboarding)/ready.tsx`'s Decision 13 discipline — `HubSubtitle`'s `variant` tag is what
 * lets this switch stay exhaustive and type-checked. */
function resolveSubtitle(t: Translate, subtitle: HubSubtitle): string {
  switch (subtitle.variant) {
    case 'raw':
      return subtitle.text;
    case 'account_no_bank':
      return t('settings.hub.account_sub_no_bank');
    case 'banks_empty':
      return t('settings.hub.banks_sub_empty');
    case 'banks_single':
      return t('settings.hub.banks_sub_single', { banks: subtitle.banks, products: subtitle.products });
    case 'banks_plural':
      return t('settings.hub.banks_sub_plural', { banks: subtitle.banks, products: subtitle.products });
    case 'categories':
      return t('settings.hub.categories_sub', { expense: subtitle.expense, income: subtitle.income });
    case 'about_version':
      return t('settings.hub.about_sub', { version: subtitle.version });
  }
}

/** `SETTINGS_HUB_ROWS`' `iconKey`/`titleKey` are catalogue-key *values*, read for
 * self-documentation and `settings-hub.test.ts`'s structural assertions — but i18next's
 * generated `t()` type only accepts a literal key, so the route resolves each row's copy through
 * this literal switch on `screenId` rather than calling `t(row.iconKey)` dynamically. */
function resolveRowCopy(t: Translate, row: SettingsHubRowDescriptor): { icon: string; title: string } {
  switch (row.screenId) {
    case 'settings-account':
      return { icon: t('settings.hub.account_icon'), title: t('settings.hub.account_title') };
    case 'settings-banks':
      return { icon: t('settings.hub.banks_icon'), title: t('settings.hub.banks_title') };
    case 'settings-notifications':
      return { icon: t('settings.hub.reminders_icon'), title: t('settings.hub.reminders_title') };
    case 'settings-categories':
      return { icon: t('settings.hub.categories_icon'), title: t('settings.hub.categories_title') };
    case 'settings-about':
      return { icon: t('settings.hub.about_icon'), title: t('settings.hub.about_title') };
    default:
      return { icon: '', title: '' };
  }
}

/**
 * `#screen=settings` (implementation plan for issue #19, Decision 14). Composition-only: one
 * `ListGroup` of five `ListRow`s from `useSettingsHub()`. The reminders row is the one subtitle
 * this route composes itself — every day-label translation lives in the same place
 * `onboarding-ready` already established, not re-derived here (Decision 15).
 */
export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const state = useSettingsHub();

  const row = state.status === 'ready' ? state.row : undefined;

  const remindersSubtitle =
    row !== undefined && remindersAreFullyConfigured(row.reminders)
      ? t('settings.hub.reminders_sub', {
          time: formatWallClockLabel(row.reminders.timeOfDay as string),
          days: reminderDaysLabel(t, row.reminders.days as number[]),
        })
      : t('settings.hub.reminders_sub_disabled');

  const subtitleByScreenId: Record<string, string> = {
    'settings-account': row !== undefined ? resolveSubtitle(t, accountSubtitle(row.rut)) : '',
    'settings-banks':
      row !== undefined ? resolveSubtitle(t, banksSubtitle(row.bankCount, row.productCount)) : '',
    'settings-notifications': remindersSubtitle,
    'settings-categories':
      row !== undefined ? resolveSubtitle(t, categoriesSubtitle(row.categories)) : '',
    'settings-about': row !== undefined ? resolveSubtitle(t, aboutSubtitle(row.appVersion)) : '',
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('settings')}
    >
      <TopBar
        title={t('settings.title')}
        onBack={() => router.push('/(tabs)/home')}
        backAccessibilityLabel={t('settings.back_label')}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space['5'],
          paddingTop: theme.space['4'],
          paddingBottom: theme.space['8'],
        }}
      >
        <ListGroup>
          {SETTINGS_HUB_ROWS.map((hubRow) => {
            const copy = resolveRowCopy(t, hubRow);
            return (
              <ListRow
                key={hubRow.screenId}
                icon={copy.icon}
                title={copy.title}
                subtitle={subtitleByScreenId[hubRow.screenId]}
                onPress={() => router.push(hubRow.href as never)}
              />
            );
          })}
        </ListGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

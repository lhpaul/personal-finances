import { useTranslation } from 'react-i18next';

import { TopBar } from '../../../components/ui';

/** Decorative glyph, not user-facing copy — language-independent (same rationale as
 * `home.tsx`'s `HEADER_SETTINGS_GLYPH`). */
const SETTINGS_GLYPH = '⚙️';

export interface DashboardTopBarProps {
  onBack: () => void;
  onPressSettings: () => void;
}

/**
 * `mu-topbar` (implementation plan Decision 9 — **found during Step 0's residual verification**:
 * `mu-topbar*` is no longer `deferred` on the live map; item #9 shipped the `TopBar` primitive
 * and its own `FlowHeader` composes it screen-locally the same way this component does. This
 * item is the first consumer needing a *trailing* action (⚙️), so `TopBar` gained
 * `trailingAction` additively (see `TopBar.tsx`) instead of this component duplicating topbar
 * chrome.
 */
export function DashboardTopBar({ onBack, onPressSettings }: DashboardTopBarProps) {
  const { t } = useTranslation();

  return (
    <TopBar
      title={t('dashboard.header_title')}
      onBack={onBack}
      backAccessibilityLabel={t('dashboard.back_label')}
      trailingAction={{
        glyph: SETTINGS_GLYPH,
        onPress: onPressSettings,
        accessibilityLabel: t('dashboard.settings_action'),
      }}
    />
  );
}

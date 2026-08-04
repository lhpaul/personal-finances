import { Pressable, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { fontWeight } from './_internal/font-weight';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

/** Decorative glyph, not user-facing copy — language-independent (same rationale as
 * `BankRow.tsx`'s `CHEVRON_GLYPH`). */
const BACK_GLYPH = '←';

export type TopBarTitleAlign = 'center' | 'left';

export type TopBarProps = {
  title: string;
  /** Required (and rendered) only when `titleAlign` is `'center'` — the default. */
  onBack?: () => void;
  backAccessibilityLabel?: string;
  /** `--left` renders `.mu-topbar__title--left`: **no back button, no trailing spacer** (the
   * mockup-viewer chrome screens are the only mockup usage of this modifier — found in review,
   * CodeRabbit PR #80: the back button was rendering unconditionally, contradicting this same
   * doc comment). Defaults to `'center'`, the shape every product screen uses. */
  titleAlign?: TopBarTitleAlign;
};

/**
 * `.mu-topbar`, `__btn`, `__title`, `__title--left` (implementation plan for issue #9, Decision
 * 10's contingency: `mu-topbar*` was deferred first to #12, then retargeted to #8, and neither
 * shipped a topbar primitive by this item's implementation time — see the plan's
 * Implementation-start re-verification step 6). Renders no top safe-area padding of its own,
 * mirroring `ScreenHeader`'s convention: the route wraps in `SafeAreaView({ edges: ['top'] })`
 * and this component supplies only the padding below that inset.
 */
export function TopBar({ title, onBack, backAccessibilityLabel, titleAlign = 'center' }: TopBarProps) {
  const touchMetrics = TOUCH_METRICS.topBarBtn;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['3'],
        paddingHorizontal: theme.space['4'],
        paddingVertical: theme.space['3'],
        backgroundColor: theme.colors.surface1,
        borderBottomWidth: componentMetrics.borderWidth.hairline,
        borderBottomColor: theme.colors.border,
      }}
    >
      {titleAlign === 'center' && onBack !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          onPress={onBack}
          hitSlop={touchMetrics.hitSlop}
          style={{
            width: componentMetrics.topBar.buttonSize,
            height: componentMetrics.topBar.buttonSize,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: componentMetrics.topBar.buttonGlyphFontSize }}>{BACK_GLYPH}</Text>
        </Pressable>
      )}
      <Text
        center={titleAlign === 'center'}
        style={{
          flex: 1,
          fontSize: theme.typography.size.md,
          fontWeight: fontWeight(theme.typography.weight.bold),
        }}
      >
        {title}
      </Text>
      {titleAlign === 'center' && (
        <View style={{ width: componentMetrics.topBar.buttonSize }} />
      )}
    </View>
  );
}

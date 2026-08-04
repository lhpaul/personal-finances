import { Pressable, View } from 'react-native';

import { Text } from '../../../components/ui';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

/** Decorative glyph, not user-facing copy — language-independent (precedent: #13's
 * `StageTopBar`). The accessible label comes from the catalogue instead. */
const BACK_GLYPH = '←';

export interface DetailTopBarProps {
  title: string;
  backA11yLabel: string;
  onBack: () => void;
}

/**
 * A screen-local composition of `mu-topbar` / `mu-topbar__btn` / `mu-topbar__title` (deferred to
 * #12 in `MU_CLASS_MAP` — implementation plan Decision 10). The mockup draws only a back control
 * and a balancing trailing spacer — no close button — unlike #13's `StageTopBar`, which this
 * mirrors in every other respect.
 */
export function DetailTopBar({ title, backA11yLabel, onBack }: DetailTopBarProps) {
  const buttonSize = screenMetrics.transactionDetail.topBarButtonSize;
  const buttonHitSlopSize = Math.max(0, Math.ceil((theme.touchTarget.min - buttonSize) / 2));
  const buttonHitSlop = {
    top: buttonHitSlopSize,
    bottom: buttonHitSlopSize,
    left: buttonHitSlopSize,
    right: buttonHitSlopSize,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space['3'],
        paddingHorizontal: theme.space['4'],
        paddingVertical: theme.space['3'],
        borderBottomWidth: componentMetrics.borderWidth.hairline,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backA11yLabel}
        onPress={onBack}
        hitSlop={buttonHitSlop}
        style={{ width: buttonSize, height: buttonSize, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: screenMetrics.transactionDetail.topBarButtonGlyphSize }}>{BACK_GLYPH}</Text>
      </Pressable>
      <Text variant="h3" center style={{ flexShrink: 1 }}>
        {title}
      </Text>
      <View style={{ width: buttonSize, height: buttonSize }} />
    </View>
  );
}

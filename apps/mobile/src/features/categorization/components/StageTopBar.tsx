import { Pressable, View } from 'react-native';

import { Text } from '../../../components/ui';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy — language-independent (Decision 3 precedent set by
 * `CategoryChip`'s `STAR_GLYPH`). The accessible label comes from the catalogue instead. */
const BACK_GLYPH = '←';
const CLOSE_GLYPH = '✕';

export interface StageTopBarProps {
  title: string;
  backA11yLabel?: string;
  onBack?: () => void;
  closeA11yLabel?: string;
  onClose?: () => void;
}

/**
 * A screen-local composition of `mu-topbar` / `mu-topbar__btn` / `mu-topbar__title` (deferred to
 * #12 in `MU_CLASS_MAP` — implementation plan Decision 13). Built from `Text` and a plain
 * `Pressable`, not a new `components/ui/` primitive.
 */
export function StageTopBar({ title, backA11yLabel, onBack, closeA11yLabel, onClose }: StageTopBarProps) {
  const buttonSize = screenMetrics.categorization.topBarButtonSize;
  // The visible button stays at the mockup's 36×36 size (enlarging it would break fidelity
  // parity), but `hitSlop` extends the touch-registration area to `theme.touchTarget.min` on
  // every side without changing what is drawn — the same `withMinTarget` calculation
  // `components/ui/_internal/touch-metrics.ts` uses, inlined here because this is a screen-local
  // composition, not a `components/ui/` primitive (CodeRabbit finding on PR #79).
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
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backA11yLabel}
          onPress={onBack}
          hitSlop={buttonHitSlop}
          style={{ width: buttonSize, height: buttonSize, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: screenMetrics.categorization.topBarButtonGlyphSize }}>{BACK_GLYPH}</Text>
        </Pressable>
      ) : (
        <View style={{ width: buttonSize, height: buttonSize }} />
      )}
      <Text variant="h3" center style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeA11yLabel}
          onPress={onClose}
          hitSlop={buttonHitSlop}
          style={{ width: buttonSize, height: buttonSize, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: screenMetrics.categorization.topBarButtonGlyphSize }}>{CLOSE_GLYPH}</Text>
        </Pressable>
      ) : (
        <View style={{ width: buttonSize, height: buttonSize }} />
      )}
    </View>
  );
}

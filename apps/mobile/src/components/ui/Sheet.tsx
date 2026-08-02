import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Overlay } from './_internal/Overlay';

export type SheetProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

/** `.mu-sheet`, `__grab`. Renders via the shared `_internal/Overlay`. */
export function Sheet({ visible, onRequestClose, children }: SheetProps) {
  const touchMetrics = TOUCH_METRICS.sheetDismiss;

  return (
    <Overlay align="bottom" visible={visible} onRequestClose={onRequestClose}>
      <View
        style={{
          backgroundColor: theme.colors.surface1,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          paddingTop: theme.space['3'],
          paddingHorizontal: theme.space['5'],
          paddingBottom: theme.space['8'],
          maxHeight: `${componentMetrics.sheet.maxHeightPercent}%`,
        }}
      >
        {/* Grab handle: a decorative drag affordance in the mockup that also closes the sheet
            on tap. No accessibilityLabel here — Decision 3 forbids user-facing strings inside
            src/components/ui/, and the backdrop (Overlay) already offers a labeled dismiss
            path via the screen composing this Sheet. */}
        <Pressable
          accessibilityRole="button"
          onPress={onRequestClose}
          hitSlop={touchMetrics.hitSlop}
          style={{
            width: componentMetrics.sheet.grabWidth,
            height: componentMetrics.sheet.grabHeight,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.palette.slate['300'],
            alignSelf: 'center',
            marginBottom: theme.space['4'],
          }}
        />
        <ScrollView>{children}</ScrollView>
      </View>
    </Overlay>
  );
}

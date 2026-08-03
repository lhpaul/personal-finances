import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { componentMetrics, theme } from '../../theme';

export type ProgressProps = {
  /** 0–1. Ignored when `indeterminate` is true. */
  value?: number;
  accessibilityLabel: string;
  /** Home-screen implementation plan (issue #12) Decision 10: no progress signal exists in the
   * data model for a first sync in progress, so this animates a fixed-width fill across the
   * track instead of rendering a fabricated percentage. Additive — every existing call site is
   * unaffected. */
  indeterminate?: boolean;
};

/** `.mu-progress`, `__fill`. */
export function Progress({ value = 0, accessibilityLabel, indeterminate = false }: ProgressProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!indeterminate) return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: componentMetrics.progress.indeterminateSweepMs,
          // `sweep` only drives `transform: translateX` below — `width`/`height`/`backgroundColor`
          // on the same `Animated.View` are static — so the native driver applies cleanly and
          // moves the loop off the JS thread (found in review, round 2).
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: componentMetrics.progress.indeterminateSweepMs,
          // `sweep` only drives `transform: translateX` below — `width`/`height`/`backgroundColor`
          // on the same `Animated.View` are static — so the native driver applies cleanly and
          // moves the loop off the JS thread (found in review, round 2).
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [indeterminate, sweep]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        indeterminate ? undefined : { min: 0, max: 100, now: Math.round(clamped * 100) }
      }
      style={{
        height: componentMetrics.progress.height,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surface3,
        overflow: 'hidden',
      }}
    >
      {indeterminate ? (
        <Animated.View
          style={{
            height: '100%',
            width: `${componentMetrics.progress.indeterminateFillFraction * 100}%`,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.brandPrimary,
            transform: [
              {
                translateX: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-50%', '150%'],
                }),
              },
            ],
          }}
        />
      ) : (
        <View
          style={{
            height: '100%',
            width: `${clamped * 100}%`,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.brandPrimary,
          }}
        />
      )}
    </View>
  );
}

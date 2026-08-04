import { Children, Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';

export type ListGroupProps = {
  children: ReactNode;
};

/**
 * `.mu-list` (implementation plan for issue #19, Decision 12) — the rounded, divided container
 * every `ListRow` sits inside. Reuses `Card`'s own radius/shadow/border tokens rather than adding
 * a second set of duplicate constants (`.mu-list`'s CSS is `background: var(--s1); border-radius:
 * var(--r-card); border: 1px solid var(--border); box-shadow: var(--sh-card);` — identical to
 * `.mu-card`'s).
 *
 * Draws a hairline divider (`.mu-item + .mu-item { border-top }`) between consecutive children,
 * not above the first — `Children.toArray` lets this work regardless of falsy/conditional
 * children a caller passes.
 */
export function ListGroup({ children }: ListGroupProps) {
  const items = Children.toArray(children);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderRadius: theme.radius.card,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        shadowColor: theme.colors.textPrimary,
        shadowOpacity: componentMetrics.shadow.card.opacity,
        shadowRadius: componentMetrics.shadow.card.radius,
        shadowOffset: { width: 0, height: componentMetrics.shadow.card.offsetY },
        elevation: componentMetrics.shadow.card.elevation,
      }}
    >
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <View
              style={{
                borderTopWidth: componentMetrics.borderWidth.hairline,
                borderTopColor: theme.colors.border,
              }}
            />
          )}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

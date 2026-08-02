import type { ReactNode } from 'react';
import { Pressable, View, type TextStyle } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { TOUCH_METRICS } from './_internal/touch-metrics';
import { Text } from './Text';

export type TabBarItem = {
  key: string;
  icon: ReactNode;
  label: string;
};

export type TabBarProps = {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

/** `.mu-tabbar`, `__item`, `__icon`, `.is-active`. */
export function TabBar({ items, activeKey, onSelect }: TabBarProps) {
  const touchMetrics = TOUCH_METRICS.tabBarItem;

  return (
    <View
      style={{
        flexShrink: 0,
        height: theme.layout.tabBarHeight,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingTop: theme.space['3'],
        paddingHorizontal: theme.space['2'],
        backgroundColor: theme.colors.tabBar,
        borderTopWidth: componentMetrics.borderWidth.hairline,
        borderTopColor: theme.colors.border,
      }}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
            onPress={() => onSelect(item.key)}
            hitSlop={touchMetrics?.hitSlop}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: componentMetrics.tabBar.itemGap,
            }}
          >
            <View
              style={{
                width: componentMetrics.tabBar.itemIconWidth,
                height: componentMetrics.tabBar.itemIconHeight,
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? theme.colors.infoBg : 'transparent',
              }}
            >
              {/* `item.icon` is commonly a raw emoji string (the mockup's tab icons); React
                  Native throws "Text strings must be rendered within a <Text> component" if a
                  bare string is a direct child of a View. Wrap it, matching how every other
                  icon-accepting primitive (Hero, Note, TransactionRow, CategoryChip,
                  EmptyState, Modal) already renders its icon slot. */}
              <Text style={{ fontSize: componentMetrics.tabBar.itemIconFontSize }}>
                {item.icon}
              </Text>
            </View>
            <Text
              variant="xs"
              tone={isActive ? 'brand' : undefined}
              style={{
                color: isActive ? theme.colors.tabBarActive : theme.colors.tabBarInactive,
                fontWeight: String(theme.typography.weight.semibold) as TextStyle['fontWeight'],
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

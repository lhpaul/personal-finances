import type { ReactNode } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Button } from './Button';
import { Text } from './Text';

export type EmptyStateAction = {
  label: string;
  onPress: () => void;
};

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
};

/** `.mu-empty`, `__icon`. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.space['8'],
        paddingHorizontal: theme.space['5'],
        gap: theme.space['3'],
      }}
    >
      <Text center style={{ fontSize: componentMetrics.emptyState.iconFontSize }}>
        {icon}
      </Text>
      <Text variant="h3" center>
        {title}
      </Text>
      {description !== undefined && (
        <Text variant="body" center>
          {description}
        </Text>
      )}
      {action !== undefined && (
        <Button variant="outline" size="sm" label={action.label} onPress={action.onPress} />
      )}
    </View>
  );
}

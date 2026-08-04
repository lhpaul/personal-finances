import { View } from 'react-native';

import { Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';

export type ProfileFactRowProps = {
  label: string;
  value: string;
  /** `true` for the first row in the card (no top margin) — mirrors the mockup's `.mu-row`
   * (no margin) / `.mu-row.mu-mt3` (later rows) pair. */
  isFirst?: boolean;
};

/**
 * `.mu-row`, `.mu-row--between` (implementation plan for issue #19, Layer-by-Layer) — both
 * already `utility` in `MU_CLASS_MAP`, so this is a screen-local composition, not a
 * `components/ui/` primitive: it is two `Text`s in a flex row with no variant surface of its
 * own (mirrors `#screen=onboarding-ready`'s `ReadySummaryRow` precedent).
 */
export function ProfileFactRow({ label, value, isFirst = false }: ProfileFactRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: isFirst ? 0 : theme.space['3'],
      }}
    >
      <Text variant="small">{label}</Text>
      <Text variant="small" style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}>
        {value}
      </Text>
    </View>
  );
}

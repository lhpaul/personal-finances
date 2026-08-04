import { Pressable, View } from 'react-native';

import { Badge, Text } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy — language-independent (`connect-bank-intro`'s own
 * accordion icon and chevron, matching the `CHEVRON_GLYPH` precedent in `BankRow.tsx`). */
const QUESTION_GLYPH = '❓';
const CHEVRON_DOWN_GLYPH = '▾';
const CHEVRON_UP_GLYPH = '▴';

/** Every visible string, pre-resolved by the caller — this component calls no hook (not even
 * `useTranslation`), so it stays directly callable for a renderer-free element-tree assertion
 * (found in review — CodeRabbit PR #80, AC28's state-coverage residual: this state had no test
 * at all before this change). */
export interface SecurityAccordionCopy {
  toggleLabel: string;
  step1: string;
  step2: string;
  step3: string;
}

export interface SecurityAccordionProps {
  expanded: boolean;
  onToggle: () => void;
  copy: SecurityAccordionCopy;
}

/**
 * `connect-bank-intro`'s "¿Cómo funciona la conexión segura?" disclosure (spec UX Rules
 * `connect-bank-intro`, Decision 11). Local state, not navigation — going back from this screen
 * leaves onboarding, it never merely closes the accordion (the route owns `expanded`, this
 * component is presentational). `mu-item*` stays deferred to #19 (Decision 10), so this is built
 * screen-local rather than as a design-system primitive.
 */
export function SecurityAccordion({ expanded, onToggle, copy }: SecurityAccordionProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space['3'],
          padding: theme.space['4'],
          marginTop: theme.space['4'],
          backgroundColor: theme.colors.surface1,
          borderRadius: theme.radius.lg,
          borderWidth: componentMetrics.borderWidth.hairline,
          borderColor: theme.colors.border,
        }}
      >
        <Text>{QUESTION_GLYPH}</Text>
        <Text style={{ flex: 1, fontSize: theme.typography.size.base }}>{copy.toggleLabel}</Text>
        <Text tone="tertiary">{expanded ? CHEVRON_UP_GLYPH : CHEVRON_DOWN_GLYPH}</Text>
      </Pressable>

      {expanded && (
        <View
          style={{
            marginTop: theme.space['3'],
            padding: theme.space['4'],
            backgroundColor: theme.colors.surface2,
            borderRadius: theme.radius.lg,
            gap: theme.space['3'],
          }}
        >
          <View style={{ flexDirection: 'row', gap: theme.space['3'], alignItems: 'flex-start' }}>
            <Badge tone="info" label="1" />
            <Text variant="small" style={{ flex: 1 }}>
              {copy.step1}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space['3'], alignItems: 'flex-start' }}>
            <Badge tone="info" label="2" />
            <Text variant="small" style={{ flex: 1 }}>
              {copy.step2}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space['3'], alignItems: 'flex-start' }}>
            <Badge tone="info" label="3" />
            <Text variant="small" style={{ flex: 1 }}>
              {copy.step3}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

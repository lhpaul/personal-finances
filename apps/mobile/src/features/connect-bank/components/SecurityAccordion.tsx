import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Text } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy — language-independent (`connect-bank-intro`'s own
 * accordion icon and chevron, matching the `CHEVRON_GLYPH` precedent in `BankRow.tsx`). */
const QUESTION_GLYPH = '❓';
const CHEVRON_DOWN_GLYPH = '▾';
const CHEVRON_UP_GLYPH = '▴';

export interface SecurityAccordionProps {
  expanded: boolean;
  onToggle: () => void;
}

/**
 * `connect-bank-intro`'s "¿Cómo funciona la conexión segura?" disclosure (spec UX Rules
 * `connect-bank-intro`, Decision 11). Local state, not navigation — going back from this screen
 * leaves onboarding, it never merely closes the accordion (the route owns `expanded`, this
 * component is presentational). `mu-item*` stays deferred to #19 (Decision 10), so this is built
 * screen-local rather than as a design-system primitive.
 */
export function SecurityAccordion({ expanded, onToggle }: SecurityAccordionProps) {
  const { t } = useTranslation();

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
        <Text style={{ flex: 1, fontSize: theme.typography.size.base }}>
          {t('connect_intro.how_it_works_toggle')}
        </Text>
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
              {t('connect_intro.how_it_works_step_1')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space['3'], alignItems: 'flex-start' }}>
            <Badge tone="info" label="2" />
            <Text variant="small" style={{ flex: 1 }}>
              {t('connect_intro.how_it_works_step_2')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space['3'], alignItems: 'flex-start' }}>
            <Badge tone="info" label="3" />
            <Text variant="small" style={{ flex: 1 }}>
              {t('connect_intro.how_it_works_step_3')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

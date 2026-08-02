import { View } from 'react-native';

import { Card, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import { CHECK_GLYPH } from '../value-steps';

export type ValueStepPageProps = {
  /** Page width from `useWindowDimensions()`, read on every render (Risk table — measure
   * fresh, never capture once, so a rotation/foldable re-measure is reflected). */
  width: number;
  glyph: string;
  title: string;
  body: string;
  /** Present (and non-empty) on step 1 only — `#s-onboarding-value[data-states="step-1"]`'s
   * checklist card (implementation plan Decision 4). */
  checklist?: string[];
};

/**
 * One `onboarding-value` carousel page: glyph, `Text variant="h2"`, `Text variant="bodyLead"`,
 * and (step 1 only) the `Card variant="flat"` checklist — rendered **inside** the page so it
 * travels with it instead of appearing/disappearing under a static footer (Decision 4).
 *
 * Presentational and copy-free: every string is passed in already translated by the screen
 * (Decision 3 — the same contract `RoutePlaceholder` and every `components/ui/` primitive
 * follow).
 */
export function ValueStepPage({ width, glyph, title, body, checklist }: ValueStepPageProps) {
  return (
    <View style={{ width, alignItems: 'center', paddingHorizontal: theme.space['5'] }}>
      <Text style={{ fontSize: screenMetrics.onboarding.heroGlyphSize }}>{glyph}</Text>
      <Text variant="h2" center style={{ marginTop: theme.space['4'] }}>
        {title}
      </Text>
      <Text variant="bodyLead" center style={{ marginTop: theme.space['3'] }}>
        {body}
      </Text>
      {checklist !== undefined && checklist.length > 0 && (
        <View style={{ marginTop: theme.space['6'], width: '100%' }}>
          <Card variant="flat">
            {checklist.map((item, index) => (
              <View
                key={item}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space['2'],
                  marginTop: index === 0 ? 0 : theme.space['3'],
                }}
              >
                <Text>{CHECK_GLYPH}</Text>
                <Text variant="small">{item}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
    </View>
  );
}

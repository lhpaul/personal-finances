import { View } from 'react-native';

import { Card, Text } from '../../../components/ui';
import { componentMetrics, screenMetrics, theme } from '../../../theme';
import { fontWeight } from '../../../components/ui/_internal/font-weight';

/** Decorative glyphs, not user-facing copy — language-independent (implementation plan for issue
 * #18, mirroring item #8's Decision 11 precedent). */
const PHONE_GLYPH = '📱';
const CHALLENGE_GLYPH = '💰';

export type SamplePushCardProps = {
  caption: string;
  appName: string;
  time: string;
  title: string;
  body: string;
};

/**
 * The framed sample push notification `notifications-intro` draws (`index.html:1001-1015`,
 * implementation plan for issue #18, Layer-by-Layer). Purely presentational — every string is
 * passed in already translated (Decision 3's convention, mirroring `ReadySummaryRow`).
 */
export function SamplePushCard({ caption, appName, time, title, body }: SamplePushCardProps) {
  return (
    <Card>
      <Text variant="small" center>
        {PHONE_GLYPH} {caption}
      </Text>
      <View style={{ marginTop: theme.space['3'] }}>
        <Card variant="flat">
          <View style={{ flexDirection: 'row', gap: theme.space['3'] }}>
            <Text style={{ fontSize: screenMetrics.reminders.samplePushGlyphSize }}>{CHALLENGE_GLYPH}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text
                  variant="small"
                  style={{ fontWeight: fontWeight(theme.typography.weight.semibold) }}
                >
                  {appName}
                </Text>
                <Text variant="xs">{time}</Text>
              </View>
              <Text variant="small" style={{ marginTop: componentMetrics.card.subMarginTop }}>
                <Text
                  variant="small"
                  style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}
                >
                  {CHALLENGE_GLYPH} {title}
                </Text>{' '}
                {body}
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </Card>
  );
}

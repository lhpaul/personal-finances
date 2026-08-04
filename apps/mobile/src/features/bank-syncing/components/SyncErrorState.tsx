import { View } from 'react-native';

import { Button, Note, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy (mockup literals — non-negotiable 8 governs text,
 * not emoji). */
const WARNING_GLYPH = '⚠️';
const DANGER_NOTE_ICON = '💡';

/** Every visible string, pre-resolved by the caller — this component calls no hook, so it stays
 * directly callable for a renderer-free element-tree assertion (Decision 8 precedent). */
export interface SyncErrorStateCopy {
  headline: string;
  /** `FAILURE_BODY_KEY[failureKind]`, already resolved (Decision 7). */
  body: string;
  dangerNote: string;
  retryCta: string;
  chooseOtherBankCta: string;
}

export interface SyncErrorStateProps {
  copy: SyncErrorStateCopy;
  onRetry: () => void;
  onChooseOtherBank: () => void;
}

/** The `⚠️` block, the per-code body (Decision 7), the danger `Note`, and the two buttons
 * (`#screen=bank-syncing&state=error`). */
export function SyncErrorState({ copy, onRetry, onChooseOtherBank }: SyncErrorStateProps) {
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Text center style={{ fontSize: screenMetrics.bankSyncing.headlineIconFontSize }}>
          {WARNING_GLYPH}
        </Text>
        <Text variant="h2" center style={{ marginTop: theme.space['4'] }}>
          {copy.headline}
        </Text>
        <Text variant="body" center style={{ marginTop: theme.space['2'] }}>
          {copy.body}
        </Text>
      </View>

      <View style={{ marginTop: theme.space['5'] }}>
        <Note tone="danger" icon={DANGER_NOTE_ICON}>
          {copy.dangerNote}
        </Note>
      </View>

      <View style={{ marginTop: theme.space['6'], gap: theme.space['3'] }}>
        <Button label={copy.retryCta} onPress={onRetry} />
        <Button variant="ghost" label={copy.chooseOtherBankCta} onPress={onChooseOtherBank} />
      </View>
    </View>
  );
}

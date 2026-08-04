import { Pressable, View } from 'react-native';
import type { AliasCandidate } from '@finanzas/shared-domain';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, Text } from '../../../components/ui';
import type { MerchantAliasView } from '../../../db/types';
import { componentMetrics, screenMetrics, theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy — see `StageTopBar`'s `BACK_GLYPH` precedent. */
const RECEIPT_GLYPH = '🧾';
const CHEVRON_GLYPH = '▾';

export interface MerchantAliasesDisclosureProps {
  /** `aliases.length + candidates.length` (`computeDisclosureCount`, non-negotiable #6). */
  count: number;
  onPress: () => void;
}

/**
 * The `default`-state disclosure row, "Posibles nombres legales (N)" (implementation plan
 * Layer-by-Layer). A screen-local composition of `mu-item` (deferred to #19 in `mu-class-map.ts`)
 * — the same pattern `NotSureDisclosure` (#13) already established for this repository. Tapping
 * it opens the `suggestions` state (Decision 4); it never expands inline.
 */
export function MerchantAliasesDisclosure({ count, onPress }: MerchantAliasesDisclosureProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['3'],
        padding: theme.space['4'],
        borderRadius: theme.radius.lg,
        borderWidth: componentMetrics.borderWidth.hairline,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <Text>{RECEIPT_GLYPH}</Text>
      <Text variant="body" style={{ flex: 1 }}>
        {t('merchant.edit.aliases_disclosure', { count })}
      </Text>
      <Text tone="tertiary" style={{ fontSize: screenMetrics.merchants.disclosureChevronSize }}>
        {CHEVRON_GLYPH}
      </Text>
    </Pressable>
  );
}

interface AliasesListRow {
  key: string;
  rawPattern: string;
  movementCount: number;
  /** `'current'` -> "Actual" badge, read-only. `'candidate'` -> "Agrupar" badge, tappable. */
  kind: 'current' | 'candidate';
}

function AliasRow({
  row,
  onGroup,
}: {
  row: AliasesListRow;
  onGroup: (rawPattern: string) => void;
}) {
  const { t } = useTranslation();
  const movementsLabel =
    row.movementCount === 1
      ? t('merchant.edit.alias_movements_one', { count: row.movementCount })
      : t('merchant.edit.alias_movements_other', { count: row.movementCount });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space['3'],
        paddingVertical: theme.space['3'],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="mono">{row.rawPattern}</Text>
        <Text variant="small" style={{ marginTop: screenMetrics.merchants.itemSubMarginTop }}>
          {movementsLabel}
        </Text>
      </View>
      {row.kind === 'current' ? (
        <Badge tone="ok" label={t('merchant.edit.alias_badge_current')} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('merchant.edit.alias_badge_group')}
          onPress={() => onGroup(row.rawPattern)}
        >
          <Badge tone="info" label={t('merchant.edit.alias_badge_group')} />
        </Pressable>
      )}
    </View>
  );
}

export interface MerchantAliasesCardProps {
  aliases: MerchantAliasView[];
  candidates: AliasCandidate[];
  onGroupCandidate: (candidate: AliasCandidate) => void;
  onClose: () => void;
}

/**
 * The `suggestions`-state card, "Nombres detectados en tus movimientos" (implementation plan
 * Layer-by-Layer, Decision 10; brief AC1, AC3). "Actual" rows come from `aliases` (already
 * grouped, real `match_count`); "Agrupar" rows come from `candidates` (device-derived
 * suggestions — Decision 10, community suggestions are out of MVP). Grouping writes immediately
 * (Decision 4) through the caller's `onGroupCandidate`, which re-reads the snapshot on success —
 * this component never re-derives a count itself.
 */
export function MerchantAliasesCard({ aliases, candidates, onGroupCandidate, onClose }: MerchantAliasesCardProps) {
  const { t } = useTranslation();

  const rows: AliasesListRow[] = [
    ...aliases.map((alias) => ({
      key: `alias-${alias.id}`,
      rawPattern: alias.rawPattern,
      movementCount: alias.matchCount,
      kind: 'current' as const,
    })),
    ...candidates.map((candidate) => ({
      key: `candidate-${candidate.rawPattern}`,
      rawPattern: candidate.rawPattern,
      movementCount: candidate.movementCount,
      kind: 'candidate' as const,
    })),
  ];

  function handleGroup(rawPattern: string): void {
    const candidate = candidates.find((item) => item.rawPattern === rawPattern);
    if (candidate) onGroupCandidate(candidate);
  }

  return (
    <Card title={t('merchant.edit.aliases_title')}>
      <View style={{ marginTop: theme.space['3'] }}>
        {rows.length === 0 ? (
          <Text variant="body">{t('merchant.edit.aliases_empty')}</Text>
        ) : (
          rows.map((row) => <AliasRow key={row.key} row={row} onGroup={handleGroup} />)
        )}
      </View>
      <View style={{ marginTop: theme.space['3'] }}>
        <Button variant="ghost" label={t('merchant.edit.aliases_close')} onPress={onClose} />
      </View>
    </Card>
  );
}

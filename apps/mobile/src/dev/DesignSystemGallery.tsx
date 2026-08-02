import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Amount,
  Badge,
  Button,
  Card,
  CategoryChip,
  Checkbox,
  Dots,
  EmptyState,
  Hero,
  Modal,
  Note,
  Pill,
  Progress,
  Radio,
  Segment,
  Sheet,
  StatTile,
  Steps,
  Switch,
  TabBar,
  Text,
  TextField,
  TransactionRow,
} from '../components/ui';
import { theme } from '../theme';
import { galleryStrings as t } from './gallery.strings';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: theme.space['5'] }}>
      <Text variant="eyebrow">{title}</Text>
      <View style={{ marginTop: theme.space['2'], gap: theme.space['3'] }}>{children}</View>
    </View>
  );
}

/**
 * Renders every design-system primitive for manual review against `#screen=ds-components` and
 * `#screen=ds-typography` (AC3). Section order 1-7 mirrors `#screen=ds-components` exactly;
 * sections 8-16 are this plan's own ordering choice — see the implementation plan's Step 5,
 * "Canonical gallery section order".
 *
 * Presentational demo data lives in `./gallery.strings.ts`; this component contains zero
 * literal copy (Decision 9).
 */
export function DesignSystemGallery() {
  const [checked, setChecked] = useState(true);
  const [selected, setSelected] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [fieldValue, setFieldValue] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  return (
    // Sheet/Modal render an absolutely-positioned full-bleed overlay (_internal/Overlay) that
    // must be positioned relative to the viewport, not to a scrollable content container — so
    // they are siblings of the ScrollView here, not children of it (found in review: mounting
    // them inside the ScrollView anchored the overlay to the scroll content instead of the
    // screen).
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
        <View style={{ padding: theme.space['5'], paddingBottom: theme.space['16'] }}>
          <Text variant="h1">{t['ds.gallery.title']}</Text>

          <Section title={t['ds.section.buttons']}>
            <Button variant="primary" label={t['ds.button.primary']} onPress={() => undefined} />
            <Button
              variant="muted"
              label={t['ds.button.muted']}
              onPress={() => undefined}
              disabled
            />
            <Button variant="outline" label={t['ds.button.outline']} onPress={() => undefined} />
            <Button variant="ghost" label={t['ds.button.ghost']} onPress={() => undefined} />
            <Button variant="danger" label={t['ds.button.danger']} onPress={() => undefined} />
            <Button variant="dangerSoft" label={t['ds.button.dangerSoft']} onPress={() => undefined} />
            <Button
              variant="primary"
              size="sm"
              label={t['ds.button.small']}
              onPress={() => undefined}
            />
          </Section>

          <Section title={t['ds.section.badges']}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
              <Badge tone="neutral" label={t['ds.badge.neutral']} />
              <Badge tone="ok" label={t['ds.badge.ok']} />
              <Badge tone="warn" label={t['ds.badge.warn']} />
              <Badge tone="danger" label={t['ds.badge.danger']} />
              <Badge tone="info" label={t['ds.badge.info']} />
              <Badge tone="celebration" label={t['ds.badge.celebration']} />
            </View>
          </Section>

          <Section title={t['ds.section.categoryChips']}>
            <View style={{ flexDirection: 'row', gap: theme.space['2'] }}>
              <CategoryChip
                emoji={t['ds.categoryChip.suggestedEmoji']}
                label={t['ds.categoryChip.suggestedLabel']}
                state="suggested"
                onPress={() => undefined}
              />
              <CategoryChip
                emoji={t['ds.categoryChip.selectedEmoji']}
                label={t['ds.categoryChip.selectedLabel']}
                state="selected"
                onPress={() => undefined}
              />
              <CategoryChip
                emoji={t['ds.categoryChip.defaultEmoji']}
                label={t['ds.categoryChip.defaultLabel']}
                onPress={() => undefined}
              />
            </View>
          </Section>

          <Section title={t['ds.section.fields']}>
            <TextField
              label={t['ds.field.emailLabel']}
              value={fieldValue}
              onChangeText={setFieldValue}
              placeholder={t['ds.field.emailPlaceholder']}
            />
            <TextField
              label={t['ds.field.emailLabel']}
              value={t['ds.field.emailErrorValue']}
              onChangeText={() => undefined}
              error={t['ds.field.emailErrorHint']}
            />
            <TextField
              label={t['ds.field.emailLabel']}
              value={t['ds.field.emailLockedValue']}
              onChangeText={() => undefined}
              locked
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['5'] }}>
              <Checkbox
                checked={checked}
                onChange={setChecked}
                accessibilityLabel={t['ds.field.checkboxLabel']}
              />
              <Radio
                selected={selected}
                onPress={() => setSelected((prev) => !prev)}
                accessibilityLabel={t['ds.field.radioLabel']}
              />
              <Switch
                value={switchOn}
                onValueChange={setSwitchOn}
                accessibilityLabel={t['ds.field.switchLabel']}
              />
            </View>
          </Section>

          <Section title={t['ds.section.transactions']}>
            <TransactionRow
              icon={t['ds.transaction.categorizedIcon']}
              name={t['ds.transaction.categorizedName']}
              meta={t['ds.transaction.categorizedMeta']}
              amount={t['ds.transaction.categorizedAmount']}
              direction="out"
            />
            <TransactionRow
              icon={t['ds.transaction.pendingIcon']}
              name={t['ds.transaction.pendingName']}
              meta={t['ds.transaction.pendingMeta']}
              amount={t['ds.transaction.pendingAmount']}
              direction="out"
              state="pending"
              metaTone="warn"
            />
            <TransactionRow
              icon={t['ds.transaction.excludedIcon']}
              name={t['ds.transaction.excludedName']}
              meta={t['ds.transaction.excludedMeta']}
              amount={t['ds.transaction.excludedAmount']}
              direction="out"
              state="excluded"
            />
          </Section>

          <Section title={t['ds.section.notes']}>
            <Note tone="info" icon={t['ds.note.infoIcon']}>
              {t['ds.note.info']}
            </Note>
            <Note tone="ok" icon={t['ds.note.okIcon']}>
              {t['ds.note.ok']}
            </Note>
            <Note tone="warn" icon={t['ds.note.warnIcon']}>
              {t['ds.note.warn']}
            </Note>
            <Note tone="danger" icon={t['ds.note.dangerIcon']}>
              {t['ds.note.danger']}
            </Note>
          </Section>

          <Section title={t['ds.section.statTiles']}>
            <View style={{ flexDirection: 'row', gap: theme.space['3'] }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  tone="income"
                  label={t['ds.stat.incomeLabel']}
                  value={t['ds.stat.incomeValue']}
                  sub={t['ds.stat.incomeSub']}
                  arrow="up"
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile
                  tone="expense"
                  label={t['ds.stat.expenseLabel']}
                  value={t['ds.stat.expenseValue']}
                  sub={t['ds.stat.expenseSub']}
                  arrow="down"
                />
              </View>
            </View>
          </Section>

          <Section title={t['ds.section.typography']}>
            <Text variant="small">{t['ds.typography.intro']}</Text>
            <Text variant="h1">{t['ds.typography.h1']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.h1Caption']}
            </Text>
            <Text variant="h2">{t['ds.typography.h2']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.h2Caption']}
            </Text>
            <Text variant="h3">{t['ds.typography.h3']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.h3Caption']}
            </Text>
            <Text variant="body">{t['ds.typography.body']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.bodyCaption']}
            </Text>
            <Text variant="small">{t['ds.typography.small']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.smallCaption']}
            </Text>
            <Text variant="eyebrow">{t['ds.typography.eyebrow']}</Text>
            <Text variant="xs" tone="tertiary">
              {t['ds.typography.eyebrowCaption']}
            </Text>
          </Section>

          <Section title={t['ds.section.amounts']}>
            <Amount size="hero" tone="neutral" formatted={t['ds.amount.hero']} />
            <Text variant="xs" tone="tertiary">
              {t['ds.amount.heroCaption']}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space['5'] }}>
              <View>
                <Amount size="lg" tone="in" formatted={t['ds.amount.in']} />
                <Text variant="xs" tone="tertiary">
                  {t['ds.amount.inCaption']}
                </Text>
              </View>
              <View>
                <Amount size="lg" tone="out" formatted={t['ds.amount.out']} />
                <Text variant="xs" tone="tertiary">
                  {t['ds.amount.outCaption']}
                </Text>
              </View>
            </View>
            <Text variant="hint">{t['ds.amount.hint']}</Text>
          </Section>

          <Section title={t['ds.section.cards']}>
            <Card title={t['ds.card.defaultTitle']} subtitle={t['ds.card.defaultSub']} />
            <Card variant="tight" title={t['ds.card.tightTitle']} subtitle={t['ds.card.tightSub']} />
            <Card variant="flat" title={t['ds.card.flatTitle']} subtitle={t['ds.card.flatSub']} />
          </Section>

          <Section title={t['ds.section.hero']}>
            <Hero
              gradient="challenge"
              icon={t['ds.hero.icon']}
              title={t['ds.hero.title']}
              subtitle={t['ds.hero.subtitle']}
            />
          </Section>

          <Section title={t['ds.section.segmentsAndPills']}>
            <Segment
              options={[
                { value: 'week', label: t['ds.segment.optionWeek'] },
                { value: 'month', label: t['ds.segment.optionMonth'] },
              ]}
              value={period}
              onChange={(value) => setPeriod(value as 'week' | 'month')}
            />
            <View style={{ flexDirection: 'row', gap: theme.space['2'] }}>
              <Pill
                label={t['ds.pill.optionAll']}
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              <Pill
                label={t['ds.pill.optionIncome']}
                active={filter === 'income'}
                onPress={() => setFilter('income')}
              />
              <Pill
                label={t['ds.pill.optionExpense']}
                active={filter === 'expense'}
                onPress={() => setFilter('expense')}
              />
            </View>
          </Section>

          <Section title={t['ds.section.progress']}>
            <Progress value={0.6} accessibilityLabel={t['ds.progress.label']} />
            <Steps total={4} current={2} />
            <Dots total={4} current={2} />
          </Section>

          <Section title={t['ds.section.emptyState']}>
            <EmptyState
              icon={t['ds.emptyState.icon']}
              title={t['ds.emptyState.title']}
              description={t['ds.emptyState.description']}
              action={{ label: t['ds.emptyState.action'], onPress: () => undefined }}
            />
          </Section>

          <Section title={t['ds.section.tabBar']}>
            <TabBar
              items={[
                { key: 'home', icon: t['ds.tabBar.homeIcon'], label: t['ds.tabBar.homeLabel'] },
                {
                  key: 'transactions',
                  icon: t['ds.tabBar.transactionsIcon'],
                  label: t['ds.tabBar.transactionsLabel'],
                },
              ]}
              activeKey={activeTab}
              onSelect={setActiveTab}
            />
          </Section>

          <Section title={t['ds.section.sheetAndModal']}>
            <Button
              variant="outline"
              label={t['ds.sheet.openLabel']}
              onPress={() => setSheetVisible(true)}
            />
            <Button
              variant="outline"
              label={t['ds.modal.openLabel']}
              onPress={() => setModalVisible(true)}
            />
          </Section>
        </View>
      </ScrollView>

      <Sheet visible={sheetVisible} onRequestClose={() => setSheetVisible(false)}>
        <Text variant="body">{t['ds.sheet.content']}</Text>
      </Sheet>

      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        icon={t['ds.modal.icon']}
        title={t['ds.modal.title']}
      >
        <Text variant="body" center>
          {t['ds.modal.body']}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space['3'],
            marginTop: theme.space['5'],
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              variant="outline"
              label={t['ds.modal.cancelLabel']}
              onPress={() => setModalVisible(false)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="danger"
              label={t['ds.modal.confirmLabel']}
              onPress={() => setModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

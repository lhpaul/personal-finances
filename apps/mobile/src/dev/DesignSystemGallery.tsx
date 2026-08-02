import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
 * Demo copy lives in the `ds.*` catalogue keys under `apps/mobile/src/i18n/{es,en}.json`,
 * resolved here through `useTranslation()`; this component contains zero literal copy
 * (Decision 9).
 */
export function DesignSystemGallery() {
  const { t } = useTranslation();
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
          <Text variant="h1">{t('ds.gallery.title')}</Text>

          <Section title={t('ds.section.buttons')}>
            <Button variant="primary" label={t('ds.button.primary')} onPress={() => undefined} />
            <Button
              variant="muted"
              label={t('ds.button.muted')}
              onPress={() => undefined}
              disabled
            />
            <Button variant="outline" label={t('ds.button.outline')} onPress={() => undefined} />
            <Button variant="ghost" label={t('ds.button.ghost')} onPress={() => undefined} />
            <Button variant="danger" label={t('ds.button.danger')} onPress={() => undefined} />
            <Button
              variant="dangerSoft"
              label={t('ds.button.danger_soft')}
              onPress={() => undefined}
            />
            <Button
              variant="primary"
              size="sm"
              label={t('ds.button.small')}
              onPress={() => undefined}
            />
          </Section>

          <Section title={t('ds.section.badges')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
              <Badge tone="neutral" label={t('ds.badge.neutral')} />
              <Badge tone="ok" label={t('ds.badge.ok')} />
              <Badge tone="warn" label={t('ds.badge.warn')} />
              <Badge tone="danger" label={t('ds.badge.danger')} />
              <Badge tone="info" label={t('ds.badge.info')} />
              <Badge tone="celebration" label={t('ds.badge.celebration')} />
            </View>
          </Section>

          <Section title={t('ds.section.category_chips')}>
            <View style={{ flexDirection: 'row', gap: theme.space['2'] }}>
              <CategoryChip
                emoji={t('ds.category_chip.suggested_emoji')}
                label={t('ds.category_chip.suggested_label')}
                state="suggested"
                onPress={() => undefined}
              />
              <CategoryChip
                emoji={t('ds.category_chip.selected_emoji')}
                label={t('ds.category_chip.selected_label')}
                state="selected"
                onPress={() => undefined}
              />
              <CategoryChip
                emoji={t('ds.category_chip.default_emoji')}
                label={t('ds.category_chip.default_label')}
                onPress={() => undefined}
              />
            </View>
          </Section>

          <Section title={t('ds.section.fields')}>
            <TextField
              label={t('ds.field.email_label')}
              value={fieldValue}
              onChangeText={setFieldValue}
              placeholder={t('ds.field.email_placeholder')}
            />
            <TextField
              label={t('ds.field.email_label')}
              value={t('ds.field.email_error_value')}
              onChangeText={() => undefined}
              error={t('ds.field.email_error_hint')}
            />
            <TextField
              label={t('ds.field.email_label')}
              value={t('ds.field.email_locked_value')}
              onChangeText={() => undefined}
              locked
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['5'] }}>
              <Checkbox
                checked={checked}
                onChange={setChecked}
                accessibilityLabel={t('ds.field.checkbox_label')}
              />
              <Radio
                selected={selected}
                onPress={() => setSelected((prev) => !prev)}
                accessibilityLabel={t('ds.field.radio_label')}
              />
              <Switch
                value={switchOn}
                onValueChange={setSwitchOn}
                accessibilityLabel={t('ds.field.switch_label')}
              />
            </View>
          </Section>

          <Section title={t('ds.section.transactions')}>
            <TransactionRow
              icon={t('ds.transaction.categorized_icon')}
              name={t('ds.transaction.categorized_name')}
              meta={t('ds.transaction.categorized_meta')}
              amount={t('ds.transaction.categorized_amount')}
              direction="out"
            />
            <TransactionRow
              icon={t('ds.transaction.pending_icon')}
              name={t('ds.transaction.pending_name')}
              meta={t('ds.transaction.pending_meta')}
              amount={t('ds.transaction.pending_amount')}
              direction="out"
              state="pending"
              metaTone="warn"
            />
            <TransactionRow
              icon={t('ds.transaction.excluded_icon')}
              name={t('ds.transaction.excluded_name')}
              meta={t('ds.transaction.excluded_meta')}
              amount={t('ds.transaction.excluded_amount')}
              direction="out"
              state="excluded"
            />
          </Section>

          <Section title={t('ds.section.notes')}>
            <Note tone="info" icon={t('ds.note.info_icon')}>
              {t('ds.note.info')}
            </Note>
            <Note tone="ok" icon={t('ds.note.ok_icon')}>
              {t('ds.note.ok')}
            </Note>
            <Note tone="warn" icon={t('ds.note.warn_icon')}>
              {t('ds.note.warn')}
            </Note>
            <Note tone="danger" icon={t('ds.note.danger_icon')}>
              {t('ds.note.danger')}
            </Note>
          </Section>

          <Section title={t('ds.section.stat_tiles')}>
            <View style={{ flexDirection: 'row', gap: theme.space['3'] }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  tone="income"
                  label={t('ds.stat.income_label')}
                  value={t('ds.stat.income_value')}
                  sub={t('ds.stat.income_sub')}
                  arrow="up"
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile
                  tone="expense"
                  label={t('ds.stat.expense_label')}
                  value={t('ds.stat.expense_value')}
                  sub={t('ds.stat.expense_sub')}
                  arrow="down"
                />
              </View>
            </View>
          </Section>

          <Section title={t('ds.section.typography')}>
            <Text variant="small">{t('ds.typography.intro')}</Text>
            <Text variant="h1">{t('ds.typography.h1')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.h1_caption')}
            </Text>
            <Text variant="h2">{t('ds.typography.h2')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.h2_caption')}
            </Text>
            <Text variant="h3">{t('ds.typography.h3')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.h3_caption')}
            </Text>
            <Text variant="body">{t('ds.typography.body')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.body_caption')}
            </Text>
            <Text variant="small">{t('ds.typography.small')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.small_caption')}
            </Text>
            <Text variant="eyebrow">{t('ds.typography.eyebrow')}</Text>
            <Text variant="xs" tone="tertiary">
              {t('ds.typography.eyebrow_caption')}
            </Text>
          </Section>

          <Section title={t('ds.section.amounts')}>
            <Amount size="hero" tone="neutral" formatted={t('ds.amount.hero')} />
            <Text variant="xs" tone="tertiary">
              {t('ds.amount.hero_caption')}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space['5'] }}>
              <View>
                <Amount size="lg" tone="in" formatted={t('ds.amount.in')} />
                <Text variant="xs" tone="tertiary">
                  {t('ds.amount.in_caption')}
                </Text>
              </View>
              <View>
                <Amount size="lg" tone="out" formatted={t('ds.amount.out')} />
                <Text variant="xs" tone="tertiary">
                  {t('ds.amount.out_caption')}
                </Text>
              </View>
            </View>
            <Text variant="hint">{t('ds.amount.hint')}</Text>
          </Section>

          <Section title={t('ds.section.cards')}>
            <Card title={t('ds.card.default_title')} subtitle={t('ds.card.default_sub')} />
            <Card
              variant="tight"
              title={t('ds.card.tight_title')}
              subtitle={t('ds.card.tight_sub')}
            />
            <Card variant="flat" title={t('ds.card.flat_title')} subtitle={t('ds.card.flat_sub')} />
          </Section>

          <Section title={t('ds.section.hero')}>
            <Hero
              gradient="challenge"
              icon={t('ds.hero.icon')}
              title={t('ds.hero.title')}
              subtitle={t('ds.hero.subtitle')}
            />
          </Section>

          <Section title={t('ds.section.segments_and_pills')}>
            <Segment
              options={[
                { value: 'week', label: t('ds.segment.option_week') },
                { value: 'month', label: t('ds.segment.option_month') },
              ]}
              value={period}
              onChange={(value) => setPeriod(value as 'week' | 'month')}
            />
            <View style={{ flexDirection: 'row', gap: theme.space['2'] }}>
              <Pill
                label={t('ds.pill.option_all')}
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              <Pill
                label={t('ds.pill.option_income')}
                active={filter === 'income'}
                onPress={() => setFilter('income')}
              />
              <Pill
                label={t('ds.pill.option_expense')}
                active={filter === 'expense'}
                onPress={() => setFilter('expense')}
              />
            </View>
          </Section>

          <Section title={t('ds.section.progress')}>
            <Progress value={0.6} accessibilityLabel={t('ds.progress.label')} />
            <Steps total={4} current={2} />
            <Dots total={4} current={2} />
          </Section>

          <Section title={t('ds.section.empty_state')}>
            <EmptyState
              icon={t('ds.empty_state.icon')}
              title={t('ds.empty_state.title')}
              description={t('ds.empty_state.description')}
              action={{ label: t('ds.empty_state.action'), onPress: () => undefined }}
            />
          </Section>

          <Section title={t('ds.section.tab_bar')}>
            <TabBar
              items={[
                { key: 'home', icon: t('ds.tab_bar.home_icon'), label: t('ds.tab_bar.home_label') },
                {
                  key: 'transactions',
                  icon: t('ds.tab_bar.transactions_icon'),
                  label: t('ds.tab_bar.transactions_label'),
                },
              ]}
              activeKey={activeTab}
              onSelect={setActiveTab}
            />
          </Section>

          <Section title={t('ds.section.sheet_and_modal')}>
            <Button
              variant="outline"
              label={t('ds.sheet.open_label')}
              onPress={() => setSheetVisible(true)}
            />
            <Button
              variant="outline"
              label={t('ds.modal.open_label')}
              onPress={() => setModalVisible(true)}
            />
          </Section>
        </View>
      </ScrollView>

      <Sheet visible={sheetVisible} onRequestClose={() => setSheetVisible(false)}>
        <Text variant="body">{t('ds.sheet.content')}</Text>
      </Sheet>

      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        icon={t('ds.modal.icon')}
        title={t('ds.modal.title')}
      >
        <Text variant="body" center>
          {t('ds.modal.body')}
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
              label={t('ds.modal.cancel_label')}
              onPress={() => setModalVisible(false)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="danger"
              label={t('ds.modal.confirm_label')}
              onPress={() => setModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

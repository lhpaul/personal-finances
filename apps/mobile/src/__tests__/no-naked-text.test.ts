import { Text as RNText } from 'react-native';

import {
  CategoryChip,
  EmptyState,
  Hero,
  Modal,
  Note,
  TabBar,
  Text,
  TransactionRow,
} from '../components/ui';
import { findNakedText } from '../test-utils/naked-text-scan';

/**
 * Regression coverage for the class of bug found in review: a primitive rendering a
 * caller-supplied icon (commonly a raw emoji string, per this app's `theme.categoryIcons`)
 * directly as a child of a non-text host component throws "Text strings must be rendered
 * within a <Text> component" at runtime. `TabBar` did this (`icon` was a bare child of a
 * `View`); this suite exercises every primitive with an icon-shaped prop, including `TabBar`
 * with the exact scenario every consumer hits — a string icon.
 *
 * **Hook-free constraint**: every primitive below is called directly as a plain function
 * (`TabBar({...})`, not `<TabBar {...} />` through a renderer), which only works because none
 * of them call a React hook in their own function body. `Modal` composes `_internal/Overlay`
 * (which does use `useEffect`, for its Android back-button handling) only as an unexecuted JSX
 * element — `<Overlay>` is never invoked as a function here, so its hook never runs. If any of
 * these seven primitives gains its own hook, that primitive must be rendered through React
 * (e.g. via a future renderer-based tier) before its output tree is passed to `findNakedText`.
 */
describe('no naked text in icon-accepting primitives', () => {
  const textTypes = new Set<unknown>([RNText, Text]);

  it('TabBar: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = TabBar({
      items: [
        { key: 'home', icon: '🏠', label: 'Inicio' },
        { key: 'transactions', icon: '📄', label: 'Transacciones' },
      ],
      activeKey: 'home',
      onSelect: () => undefined,
    });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('Hero: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = Hero({ icon: '🎯', title: 'Título', subtitle: 'Subtítulo' });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('Note: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = Note({ icon: 'ℹ️', children: 'Contenido' });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('TransactionRow: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = TransactionRow({
      icon: '🛒',
      name: 'Nombre',
      meta: 'Meta',
      amount: '$1.000',
      direction: 'out',
    });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('CategoryChip: a string emoji does not end up as a bare child of a non-text component', () => {
    const tree = CategoryChip({ emoji: '🍔', label: 'Comida', onPress: () => undefined });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('EmptyState: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = EmptyState({ icon: '🔍', title: 'Título' });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('Modal: a string icon does not end up as a bare child of a non-text component', () => {
    const tree = Modal({
      visible: true,
      onRequestClose: () => undefined,
      icon: '🗑️',
      title: 'Título',
    });
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });
});

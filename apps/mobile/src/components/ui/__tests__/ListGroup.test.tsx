import { Text } from 'react-native';

import { collectElements } from '../../../test-utils/element-tree';
import { ListGroup } from '../ListGroup';

/** `ListGroup` calls no hook (implementation plan for issue #19, Decision 12). */

describe('ListGroup', () => {
  it('renders a divider between consecutive children, but not above the first', () => {
    const tree = ListGroup({
      children: [<Text key="a">A</Text>, <Text key="b">B</Text>, <Text key="c">C</Text>],
    });

    const dividers = collectElements(
      tree,
      (el) =>
        typeof el.props === 'object' &&
        el.props !== null &&
        'style' in el.props &&
        (el.props as { style?: { borderTopWidth?: number } }).style?.borderTopWidth !== undefined,
    );
    // Three children -> exactly two dividers (between 1-2 and 2-3).
    expect(dividers).toHaveLength(2);
  });

  it('renders no divider for a single child', () => {
    const tree = ListGroup({ children: <Text>Only</Text> });
    const dividers = collectElements(
      tree,
      (el) =>
        typeof el.props === 'object' &&
        el.props !== null &&
        'style' in el.props &&
        (el.props as { style?: { borderTopWidth?: number } }).style?.borderTopWidth !== undefined,
    );
    expect(dividers).toHaveLength(0);
  });
});

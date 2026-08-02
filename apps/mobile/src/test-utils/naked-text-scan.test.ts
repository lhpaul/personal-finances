import { createElement, type ReactNode } from 'react';

import { findNakedText } from './naked-text-scan';

function TextComponent({ children }: { children?: ReactNode }) {
  return createElement('Text', null, children);
}

function ViewComponent({ children }: { children?: ReactNode }) {
  return createElement('View', null, children);
}

describe('findNakedText', () => {
  const textTypes = new Set<unknown>([TextComponent]);

  it('returns empty for a string wrapped in a text-bearing component', () => {
    const tree = createElement(ViewComponent, null, createElement(TextComponent, null, 'hola'));
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('flags a bare string that is a direct child of a non-text component', () => {
    const tree = createElement(ViewComponent, null, 'hola');
    const result = findNakedText(tree, textTypes);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('hola');
  });

  it('flags a bare string nested inside another non-text wrapper', () => {
    const tree = createElement(
      ViewComponent,
      null,
      createElement(ViewComponent, null, 'nested'),
    );
    const result = findNakedText(tree, textTypes);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('nested');
  });

  it('does not flag once inside a text-bearing component, even through more nesting', () => {
    const tree = createElement(
      TextComponent,
      null,
      createElement(ViewComponent, null, 'still counts as inside text'),
    );
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('ignores whitespace-only and empty strings', () => {
    const tree = createElement(ViewComponent, null, '   ');
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('ignores null, undefined, and boolean children', () => {
    const tree = createElement(ViewComponent, null, null, undefined, false, true);
    expect(findNakedText(tree, textTypes)).toEqual([]);
  });

  it('walks arrays of children, flagging only the naked ones', () => {
    const tree = createElement(ViewComponent, null, [
      createElement(TextComponent, { key: '1' }, 'safe'),
      'unsafe',
    ]);
    const result = findNakedText(tree, textTypes);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('unsafe');
  });

  it('handles a numeric child the same as a string', () => {
    const tree = createElement(ViewComponent, null, 42);
    const result = findNakedText(tree, textTypes);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('42');
  });
});

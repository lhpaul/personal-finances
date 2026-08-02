/**
 * Walks a React element tree — the plain object graph returned by calling a function component
 * directly (e.g. `TabBar({...props})`), **not** a mounted/rendered tree — and finds any string
 * or number child that is not nested inside one of the given "text-bearing" component
 * references (typically `Text` from `react-native` and this repo's own `./Text`).
 *
 * This exists because React Native throws `Text strings must be rendered within a <Text>
 * component` at render time when a bare string is a direct child of a non-text host component
 * (e.g. `View`) — a class of bug this repo's test suite cannot otherwise catch, because
 * Decision 8 in the implementation plan deliberately adds no component-render test tier
 * (`@testing-library/react-native` / `react-test-renderer`). Calling a component function
 * directly and walking its **unrendered** output tree needs no such dependency.
 *
 * Limitation, by design: only one JSX level is inspected per call — nested custom components
 * (e.g. a `<Card>` inside a screen) are not recursively invoked, only checked by type identity
 * against `textTypes`. This is sufficient to catch a primitive's own icon/content slot mistakes,
 * which is the scenario this scanner targets.
 */

export type NakedTextViolation = {
  path: string;
  text: string;
};

function describeType(type: unknown): string {
  if (typeof type === 'function') {
    return type.name || 'AnonymousComponent';
  }
  if (typeof type === 'string') {
    return type;
  }
  return String(type);
}

export function findNakedText(
  node: unknown,
  textTypes: ReadonlySet<unknown>,
  insideText = false,
  path = 'root',
): NakedTextViolation[] {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }

  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node);
    if (text.trim() === '') return [];
    return insideText ? [] : [{ path, text }];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child, index) =>
      findNakedText(child, textTypes, insideText, `${path}[${index}]`),
    );
  }

  if (typeof node === 'object' && 'type' in node) {
    const element = node as { type: unknown; props?: { children?: unknown } };
    const isTextType = textTypes.has(element.type);
    const nextPath = `${path} > ${describeType(element.type)}`;
    return findNakedText(element.props?.children, textTypes, insideText || isTextType, nextPath);
  }

  return [];
}

import type { ReactElement, ReactNode } from 'react';

/**
 * A minimal, renderer-free React element-tree walker (implementation plan for issue #9, Testing
 * Strategy scenarios 8-11) — the same "call the component function directly, inspect the
 * returned element tree" style as `component-style-regressions.test.ts`, generalised to walk
 * nested `children` (arrays, fragments, `null`/`false`/`undefined` holes) instead of hand-
 * indexing `.props.children` at every call site.
 *
 * Not a substitute for a real renderer: it does not resolve custom-component children (a
 * `<BankRow>` element's own returned tree is not inlined) unless `resolveComponents` is passed,
 * in which case it re-invokes each element's `type` function with its own `props` — safe only
 * for components that call no hook (mirrors the constraint this scanner's callers already
 * satisfy: none of the three new connect-bank presentational components call a hook).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- element props/type vary by node
type AnyElement = ReactElement<any, any>;

function isElement(node: unknown): node is AnyElement {
  return (
    node !== null &&
    typeof node === 'object' &&
    Object.prototype.hasOwnProperty.call(node, 'type') &&
    Object.prototype.hasOwnProperty.call(node, 'props')
  );
}

export function collectElements(
  root: ReactNode,
  predicate: (element: AnyElement) => boolean,
  options?: { resolveComponents?: boolean },
): AnyElement[] {
  const found: AnyElement[] = [];

  function visit(node: ReactNode): void {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isElement(node)) return;

    if (predicate(node)) found.push(node);

    if (options?.resolveComponents && typeof node.type === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see module doc comment
      const rendered = (node.type as (props: any) => ReactNode)(node.props);
      visit(rendered);
      return;
    }

    const children = (node.props as { children?: ReactNode } | undefined)?.children;
    if (children !== undefined) visit(children);
  }

  visit(root);
  return found;
}

export function elementTypeName(element: AnyElement): string {
  const type = element.type;
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return type.name || 'AnonymousComponent';
  return String(type);
}

/**
 * `transaction-detail` (#16) implementation plan Decision 3, Assumption A9: the *Producto* row
 * renders the stored product `name` plus `••{mask}` when a mask is present, and the bare `name`
 * otherwise — no type-to-label abbreviation table, matching #15's Assumption A6 precedent that
 * treats a product's display label as data, not an invented mapping.
 */
export function formatProductLabel(product: { name: string; mask: string | undefined }): string {
  return product.mask !== undefined ? `${product.name} ••${product.mask}` : product.name;
}

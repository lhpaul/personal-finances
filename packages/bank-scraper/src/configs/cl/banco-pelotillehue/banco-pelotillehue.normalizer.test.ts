import { mapProductKind } from './banco-pelotillehue.normalizer';

describe('mapProductKind', () => {
  it('maps the synthetic kinds', () => {
    expect(mapProductKind('cuenta-corriente')).toBe('checking');
    expect(mapProductKind('tarjeta-credito')).toBe('credit_card');
    expect(mapProductKind('linea-de-credito')).toBeNull();
  });
});

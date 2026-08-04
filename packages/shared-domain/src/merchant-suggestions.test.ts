import { suggestAliasCandidates } from './merchant-suggestions';

/**
 * One `it(...)` per row of the implementation plan's edge-case enumeration for issue #14
 * (parser-risk addendum). Unless a row says otherwise, the merchant is `MercadoLibre Chile` with
 * existing pattern `MERCADOLIBRE COMPRA`.
 */
const MERCHANT_NAME = 'MercadoLibre Chile';
const EXISTING_PATTERNS = ['MERCADOLIBRE COMPRA'];

function suggest(descriptions: readonly string[], overrides?: { merchantName?: string; existingPatterns?: readonly string[] }) {
  return suggestAliasCandidates({
    merchantName: overrides?.merchantName ?? MERCHANT_NAME,
    existingPatterns: overrides?.existingPatterns ?? EXISTING_PATTERNS,
    descriptions,
  });
}

describe('suggestAliasCandidates — edge-case enumeration', () => {
  it('row 1: MERPAGO*MERCADOLIBRE -> one candidate, rawPattern MERPAGO MERCADOLIBRE (P1 after normalization)', () => {
    const result = suggest(['MERPAGO*MERCADOLIBRE']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 1 });
  });

  it('row 2: ML CHILE SPA -> no candidate (ML too short, CHILE and SPA generic)', () => {
    expect(suggest(['ML CHILE SPA'])).toEqual([]);
  });

  it('row 3: BANCO DE CHILE COMISION -> no candidate (shares no distinctive token)', () => {
    expect(suggest(['BANCO DE CHILE COMISION'])).toEqual([]);
  });

  it('row 4: an already-aliased leading pattern is never suggested', () => {
    expect(suggest(['MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO'])).toEqual([]);
  });

  it('row 5: MERCADOPAGO SERVICIOS -> one candidate (P3 shared prefix MERCADO, 7 chars)', () => {
    const result = suggest(['MERCADOPAGO SERVICIOS']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERCADOPAGO SERVICIOS', movementCount: 1 });
  });

  it('row 6: MERCADOLIBRECL PAGO -> one candidate (P2 containment: MERCADOLIBRE is a prefix of MERCADOLIBRECL)', () => {
    const result = suggest(['MERCADOLIBRECL PAGO']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERCADOLIBRECL PAGO', movementCount: 1 });
  });

  it('row 7: multiple occurrences on one line collapse to one candidate, not two', () => {
    const result = suggest(['TIENDA MERCADOLIBRE SUCURSAL MERCADOLIBRE']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'TIENDA MERCADOLIBRE', movementCount: 1 });
  });

  it('row 8: three identical descriptions group by pattern, not by row -> movementCount 3', () => {
    const result = suggest(['MERPAGO*MERCADOLIBRE', 'MERPAGO*MERCADOLIBRE', 'MERPAGO*MERCADOLIBRE']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 3 });
  });

  it('row 9: the leading token run is the shared stable part; the variable tail is dropped', () => {
    const result = suggest(['MERPAGO*MERCADOLIBRE', 'MERPAGO MERCADOLIBRE 0001']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 2 });
  });

  it('row 10: a single-token description -> rawPattern is the whole token (fewer tokens than CANDIDATE_TOKEN_COUNT)', () => {
    const result = suggest(['MERCADOLIBRE']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERCADOLIBRE', movementCount: 1 });
  });

  it('row 11: an all-punctuation description normalizes to empty and is dropped, never crashes', () => {
    expect(() => suggest(['***'])).not.toThrow();
    expect(suggest(['***'])).toEqual([]);
  });

  it('row 12: an empty string is dropped', () => {
    expect(suggest([''])).toEqual([]);
  });

  it('row 13: no merchant name and no existing patterns -> no evidence source, no suggestion', () => {
    expect(suggest(['MERPAGO*MERCADOLIBRE'], { merchantName: '', existingPatterns: [] })).toEqual([]);
  });

  it('row 14: six qualifying families -> exactly MAX_ALIAS_CANDIDATES, highest movementCount first', () => {
    const descriptions = [
      ...Array(6).fill('MERCADOLIBRE UNO'),
      ...Array(5).fill('MERCADOLIBRE DOS'),
      ...Array(4).fill('MERCADOLIBRE TRES'),
      ...Array(3).fill('MERCADOLIBRE CUATRO'),
      ...Array(2).fill('MERCADOLIBRE CINCO'),
      ...Array(1).fill('MERCADOLIBRE SEIS'),
    ] as string[];
    const result = suggest(descriptions);
    expect(result).toHaveLength(5);
    expect(result.map((c) => c.movementCount)).toEqual([6, 5, 4, 3, 2]);
    expect(result.map((c) => c.rawPattern)).toEqual([
      'MERCADOLIBRE UNO',
      'MERCADOLIBRE DOS',
      'MERCADOLIBRE TRES',
      'MERCADOLIBRE CUATRO',
      'MERCADOLIBRE CINCO',
    ]);
  });

  it('row 15: two families with equal movementCount -> ASCII-ascending rawPattern tie-break', () => {
    const result = suggest(['MERCADOLIBRE BETA', 'MERCADOLIBRE ALFA']);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.rawPattern)).toEqual(['MERCADOLIBRE ALFA', 'MERCADOLIBRE BETA']);
  });

  it('row 16: input order never affects the result', () => {
    const forward = suggest(['MERCADOLIBRE BETA', 'MERCADOLIBRE ALFA']);
    const backward = suggest(['MERCADOLIBRE ALFA', 'MERCADOLIBRE BETA']);
    expect(forward).toEqual(backward);
  });

  it('row 17: diacritic folding through normalizeDescription produces the same candidate as row 1', () => {
    const result = suggest(['MERPAGO*MÉRCADOLÍBRE']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 1 });
  });

  it('row 18: case folding produces the same candidate as row 1', () => {
    const result = suggest(['merpago*mercadolibre']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 1 });
  });

  it('row 19: leading/trailing and collapsed inner whitespace produce the same candidate as row 1', () => {
    const result = suggest(['  MERPAGO*MERCADOLIBRE   ']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawPattern: 'MERPAGO MERCADOLIBRE', movementCount: 1 });
  });

  it('row 20: a short merchant token (UBER) never claims an unrelated longer word (UBERTO) — the classic false positive a bare substring search would produce', () => {
    const result = suggest(['UBERTO PANADERIA'], { merchantName: 'Uber', existingPatterns: ['UBER *TRIP'] });
    expect(result).toEqual([]);
  });

  it('row 6 stays green alongside row 20 — P2 containment still fires for a genuinely long merchant token', () => {
    const result = suggest(['MERCADOLIBRECL PAGO']);
    expect(result).toHaveLength(1);
  });
});

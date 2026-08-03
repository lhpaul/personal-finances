import type { PickerInstitution } from '../../../db/types';
import { foldForSearch, matchInstitutions, sortForPicker } from '../institution-search';

/** Implementation plan Testing Strategy scenario 7 and the Parser-risk addendum's P1-P12 table. */

const CATALOGUE: PickerInstitution[] = [
  { id: 'banco-de-chile', name: 'Banco de Chile', scraperStatus: 'available', shortName: 'BCH', brandColor: '#003da5' },
  { id: 'santander', name: 'Banco Santander', scraperStatus: 'coming_soon', shortName: 'SAN', brandColor: '#ec0000' },
  { id: 'bci', name: 'Banco BCI', scraperStatus: 'coming_soon', shortName: 'BCI', brandColor: '#00396a' },
  { id: 'banco-estado', name: 'BancoEstado', scraperStatus: 'coming_soon', shortName: 'EST', brandColor: '#e30613' },
  { id: 'falabella', name: 'Banco Falabella', scraperStatus: 'coming_soon', shortName: 'FAL', brandColor: '#78b833' },
  { id: 'itau', name: 'Banco Itaú', scraperStatus: 'coming_soon', shortName: 'ITA', brandColor: '#1b3a6b' },
];

const SORTED = sortForPicker(CATALOGUE);

function namesOf(list: PickerInstitution[]): string[] {
  return list.map((institution) => institution.name);
}

describe('foldForSearch', () => {
  it('lowercases and strips accents', () => {
    expect(foldForSearch('Itaú')).toBe('itau');
  });

  it('folds a combining-mark spelling the same as a precomposed one (P3)', () => {
    const combining = 'Itau'.slice(0, 3) + 'ú'; // "Ita" + "u" + combining acute
    expect(foldForSearch(combining)).toBe(foldForSearch('Itaú'));
  });

  it('folds ñ symmetrically (P10)', () => {
    expect(foldForSearch('Muñoz')).toBe(foldForSearch('Munoz'));
  });
});

describe('sortForPicker (Business Rule 10)', () => {
  it('lists available banks first, then coming-soon banks by name', () => {
    // Folded-name comparison (space, U+0020, sorts before a following letter) puts "BancoEstado"
    // (no space) after every "Banco <name>" entry.
    expect(namesOf(SORTED)).toEqual([
      'Banco de Chile',
      'Banco BCI',
      'Banco Falabella',
      'Banco Itaú',
      'Banco Santander',
      'BancoEstado',
    ]);
  });

  it('does not mutate its input', () => {
    const copy = [...CATALOGUE];
    sortForPicker(CATALOGUE);
    expect(CATALOGUE).toEqual(copy);
  });
});

describe('matchInstitutions (Business Rule 8, parser-risk P1-P12)', () => {
  it('P1: "itau" against "Banco Itaú" matches', () => {
    expect(namesOf(matchInstitutions(SORTED, 'itau'))).toEqual(['Banco Itaú']);
  });

  it('P2: "ITAÚ" matches — case and accent both folded', () => {
    expect(namesOf(matchInstitutions(SORTED, 'ITAÚ'))).toEqual(['Banco Itaú']);
  });

  it('P3: a combining-acute spelling of "Itaú" matches', () => {
    const combining = 'Ita' + 'ú';
    expect(namesOf(matchInstitutions(SORTED, combining))).toEqual(['Banco Itaú']);
  });

  it('P4: "estado" matches "BancoEstado" — substring, not word-boundary', () => {
    expect(namesOf(matchInstitutions(SORTED, 'estado'))).toEqual(['BancoEstado']);
  });

  it('P5: "chi" matches only "Banco de Chile" (singular count)', () => {
    const result = matchInstitutions(SORTED, 'chi');
    expect(namesOf(result)).toEqual(['Banco de Chile']);
    expect(result).toHaveLength(1);
  });

  it('P6: "banco" matches every seeded name, BancoEstado included (plural count)', () => {
    const result = matchInstitutions(SORTED, 'banco');
    expect(result).toHaveLength(6);
  });

  it('P7: the query is trimmed before folding', () => {
    expect(namesOf(matchInstitutions(SORTED, '  chi  '))).toEqual(['Banco de Chile']);
  });

  it('P8: an empty (after trim) query returns every row — the list state, not a search', () => {
    expect(matchInstitutions(SORTED, '   ')).toEqual(SORTED);
  });

  it('P9: "banco imaginario" matches nothing', () => {
    expect(matchInstitutions(SORTED, 'banco imaginario')).toEqual([]);
  });

  it('P10: "ñ" against a name containing ñ matches symmetrically', () => {
    const withEnye: PickerInstitution[] = [
      { id: 'x', name: 'Banco Muñoz', scraperStatus: 'coming_soon', shortName: 'MUN', brandColor: '#000000' },
    ];
    expect(matchInstitutions(withEnye, 'ñ')).toEqual(withEnye);
    expect(matchInstitutions(withEnye, 'n')).toEqual(withEnye);
  });

  it('P11: a regex metacharacter in the query is treated literally', () => {
    expect(matchInstitutions(SORTED, '.')).toEqual([]);
    expect(matchInstitutions(SORTED, '(')).toEqual([]);
  });

  it('P12: search renders the same relative order as list', () => {
    const result = matchInstitutions(SORTED, 'banco');
    expect(namesOf(result)).toEqual(namesOf(SORTED));
  });
});

import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { BankPickerResults } from '../components/BankPickerResults';
import {
  verifyListStateShowsBothRows,
  verifyNoResultsStateShowsEmptyState,
  verifySearchStateNarrowsResults,
} from '../state-verifiers';

/** Implementation plan Testing Strategy scenario 8 (AC7, AC8, AC9) — renderer-free element-tree
 * inspection, calling `BankPickerResults` directly (it calls no hook). The three state-defining
 * assertions below now live in `../state-verifiers.ts` and are imported both here and by
 * `state-coverage.ts` (found in review — CodeRabbit PR #80), so removing or weakening either
 * fails this file's own test too, not only a separate residual check. */

function render(query: string) {
  return BankPickerResults({
    institutions: [
      { id: 'banco-de-chile', name: 'Banco de Chile', scraperStatus: 'available', shortName: 'BCH', brandColor: '#003da5' },
      { id: 'santander', name: 'Banco Santander', scraperStatus: 'coming_soon', shortName: 'SAN', brandColor: '#ec0000' },
    ],
    query,
    onSelectInstitution: jest.fn(),
    copy: {
      listHeading: 'Bancos disponibles en Chile',
      resultCount: (count) => (count === 1 ? `${count} resultado` : `${count} resultados`),
      availableSubLabel: 'Cuentas, tarjetas y líneas',
      comingSoonLabel: 'Próximamente',
      availableBadge: 'Disponible',
      noResultsHeading: 'No encontramos ese banco',
      noResultsBody: 'Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.',
      standingNote: 'El MVP soporta Banco de Chile.',
    },
  });
}

describe('BankPickerResults — list (AC7, AC8)', () => {
  // Computed in beforeAll, not at describe-body scope (found in review — CodeRabbit PR #80):
  // code that runs during Jest's collection phase attributes a throw to the whole file, not a
  // named test, and still runs even when a --testNamePattern filter selects nothing in this
  // block.
  let rows: ReturnType<typeof collectElements>;

  beforeAll(() => {
    const tree = render('');
    rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  });

  it('lists every seeded bank', () => {
    expect(rows).toHaveLength(2);
  });

  it(
    'the available bank is pressable and carries the "Disponible" badge, the coming-soon bank is not, and the list heading (not a result count) is shown (AC8, AC9)',
    verifyListStateShowsBothRows,
  );
});

describe('BankPickerResults — search (AC10, AC11)', () => {
  it('narrows to the matching bank and shows a singular result count', verifySearchStateNarrowsResults);
});

describe('BankPickerResults — no-results (AC12)', () => {
  it('renders the empty state with no rows, when the query matches nothing', verifyNoResultsStateShowsEmptyState);
});

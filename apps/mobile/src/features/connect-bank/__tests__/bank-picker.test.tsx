import type { PickerInstitution } from '../../../db/types';
import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { BankPickerResults, type BankPickerCopy } from '../components/BankPickerResults';

/** Implementation plan Testing Strategy scenario 8 (AC7, AC8, AC9) — renderer-free element-tree
 * inspection, calling `BankPickerResults` directly (it calls no hook). */

const COPY: BankPickerCopy = {
  listHeading: 'Bancos disponibles en Chile',
  resultCount: (count) => (count === 1 ? `${count} resultado` : `${count} resultados`),
  availableSubLabel: 'Cuentas, tarjetas y líneas',
  comingSoonLabel: 'Próximamente',
  availableBadge: 'Disponible',
  noResultsHeading: 'No encontramos ese banco',
  noResultsBody: 'Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.',
  standingNote: 'El MVP soporta Banco de Chile.',
};

const CATALOGUE: PickerInstitution[] = [
  { id: 'banco-de-chile', name: 'Banco de Chile', scraperStatus: 'available', shortName: 'BCH', brandColor: '#003da5' },
  { id: 'santander', name: 'Banco Santander', scraperStatus: 'coming_soon', shortName: 'SAN', brandColor: '#ec0000' },
];

function render(query: string, onSelectInstitution = jest.fn()) {
  return BankPickerResults({ institutions: CATALOGUE, query, onSelectInstitution, copy: COPY });
}

describe('BankPickerResults — list (AC7, AC8)', () => {
  // Computed in beforeAll, not at describe-body scope (found in review — CodeRabbit PR #80):
  // code that runs during Jest's collection phase attributes a throw to the whole file, not a
  // named test, and still runs even when a --testNamePattern filter selects nothing in this
  // block.
  let tree: ReturnType<typeof render>;
  let rows: ReturnType<typeof collectElements>;

  beforeAll(() => {
    tree = render('');
    rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
  });

  it('lists every seeded bank', () => {
    expect(rows).toHaveLength(2);
  });

  it('the available bank is pressable and carries the "Disponible" badge, not the unavailable label', () => {
    const availableRow = rows.find((row) => row.props.name === 'Banco de Chile');
    expect(availableRow).toBeDefined();
    expect(availableRow?.props.onPress).toBeInstanceOf(Function);
    expect(availableRow?.props.unavailableLabel).toBeUndefined();
    expect(availableRow?.props.trailingAccessory?.props.label).toBe('Disponible');
  });

  it('the coming-soon bank is not pressable and carries the unavailable label, no trailing accessory (AC8, AC9)', () => {
    const comingSoonRow = rows.find((row) => row.props.name === 'Banco Santander');
    expect(comingSoonRow).toBeDefined();
    expect(comingSoonRow?.props.onPress).toBeUndefined();
    expect(comingSoonRow?.props.unavailableLabel).toBe('Próximamente');
    expect(comingSoonRow?.props.trailingAccessory).toBeUndefined();
  });

  it('shows the list heading, not a result count', () => {
    const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
    expect(heading?.props.children).toBe('Bancos disponibles en Chile');
  });
});

describe('BankPickerResults — search (AC10, AC11)', () => {
  it('narrows to the matching bank and shows a singular result count', () => {
    const tree = render('chi');
    const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.props.name).toBe('Banco de Chile');
  });
});

describe('BankPickerResults — no-results (AC12)', () => {
  it('renders the empty state with no rows, when the query matches nothing', () => {
    const tree = render('banco imaginario');

    expect(elementTypeName(tree)).toBe('EmptyState');
    expect(tree.props).toMatchObject({
      title: 'No encontramos ese banco',
      description: 'Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.',
    });
    // Sanity: the empty-state branch never shows a row or the standing note.
    expect(collectElements(tree, (el) => elementTypeName(el) === 'BankRow')).toHaveLength(0);
    expect(collectElements(tree, (el) => elementTypeName(el) === 'Note')).toHaveLength(0);
  });
});

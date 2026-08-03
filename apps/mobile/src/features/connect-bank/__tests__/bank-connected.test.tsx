import type { ConnectedBankSummary } from '../../../db/types';
import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { ConnectedBankSummaryList, type ConnectedBankSummaryCopy } from '../components/ConnectedBankSummaryList';

/** Implementation plan Testing Strategy scenario 11 (AC24, AC25). */

const COPY: ConnectedBankSummaryCopy = {
  headingSingle: '¡Banco conectado!',
  headingMultiple: '¡Bancos conectados!',
  congratulation: 'Excelente.',
  productsCount: (count) => (count === 1 ? `${count} producto` : `${count} productos`),
  movementsCount: (count) => (count === 1 ? `${count} movimiento` : `${count} movimientos`),
};

const ONE: ConnectedBankSummary = {
  id: 'connection-1',
  institutionName: 'Banco de Chile',
  institutionShortName: 'BCH',
  institutionBrandColor: '#003da5',
  productCount: 3,
  movementCount: 57,
};

const TWO: ConnectedBankSummary = {
  id: 'connection-2',
  institutionName: 'Banco Santander',
  institutionShortName: 'SAN',
  institutionBrandColor: '#ec0000',
  productCount: 1,
  movementCount: 1,
};

describe('ConnectedBankSummaryList — single (AC24)', () => {
  it('shows the single-bank heading and one row with the real counts', () => {
    const tree = ConnectedBankSummaryList({ connections: [ONE], copy: COPY });
    const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
    expect(heading?.props.children).toBe('¡Banco conectado!');

    const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.props.subLabel).toBe('3 productos · 57 movimientos');
  });
});

describe('ConnectedBankSummaryList — multiple (AC25)', () => {
  it('shows the pluralized heading and one row per connection, singular counts included', () => {
    const tree = ConnectedBankSummaryList({ connections: [ONE, TWO], copy: COPY });
    const heading = collectElements(tree, (el) => elementTypeName(el) === 'Text')[0];
    expect(heading?.props.children).toBe('¡Bancos conectados!');

    const rows = collectElements(tree, (el) => elementTypeName(el) === 'BankRow');
    expect(rows).toHaveLength(2);
    const second = rows.find((row) => row.props.name === 'Banco Santander');
    expect(second?.props.subLabel).toBe('1 producto · 1 movimiento');
  });

  it('shows no amounts, balances or categorization anywhere', () => {
    const tree = ConnectedBankSummaryList({ connections: [ONE, TWO], copy: COPY });
    const texts = collectElements(tree, (el) => elementTypeName(el) === 'Text').map(
      (el) => el.props.children,
    );
    for (const text of texts) {
      if (typeof text === 'string') {
        expect(text).not.toMatch(/\$/);
      }
    }
  });
});

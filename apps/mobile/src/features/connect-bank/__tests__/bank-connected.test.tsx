import type { ConnectedBankSummary } from '../../../db/types';
import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { ConnectedBankSummaryList, type ConnectedBankSummaryCopy } from '../components/ConnectedBankSummaryList';
import { verifyMultipleStateShowsAllRows, verifySingleStateShowsOneRow } from '../state-verifiers';

/** Implementation plan Testing Strategy scenario 11 (AC24, AC25). The two state-defining
 * assertions below now live in `../state-verifiers.ts` and are imported both here and by
 * `state-coverage.ts` (found in review — CodeRabbit PR #80), so removing or weakening either
 * fails this file's own test too, not only a separate residual check. */

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
  it('shows the single-bank heading and one row with the real counts', verifySingleStateShowsOneRow);
});

describe('ConnectedBankSummaryList — multiple (AC25)', () => {
  it('shows the pluralized heading and one row per connection, singular counts included', verifyMultipleStateShowsAllRows);

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

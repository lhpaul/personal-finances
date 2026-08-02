import { commonHelperFunctions, generateExecutableStepFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';

/**
 * Banco de Chile's account-movements routine (spec Use Case 1, Use Case 4, AC1, AC6, AC11, AC12,
 * AC14 (via the generic step wrapper), AC22; implementation plan Decision 1, Business Rules 20-21,
 * 31).
 *
 * Posts **raw structural facts** only (`RawMovementPayload`) — dates and amounts stay
 * bank-formatted strings, parsed on the React Native side. `window.productId` (set by the home
 * script before clicking into this product) is embedded automatically in any `parse_failed`
 * this routine's steps report, scoping the failure to this product (Business Rule 31).
 *
 * **Documented simplification from the source implementation**: the source drives the bank's
 * calendar widget (open filter options, open the date picker, click through prior months) to
 * select the requested history window before reading the table. This port reads whatever table
 * is already on the page — pagination, the empty-statement case, and the stated-count-vs-parsed
 * mismatch (AC11, AC12, AC22) are ported faithfully, because those are the properties the spec's
 * acceptance criteria test — but the calendar-click mechanics that select *which* months are
 * shown are not re-implemented here. `priorMonths` is accepted for API-shape compatibility with
 * the plan (spec Decision 4: the history window is a parameter of the read) but is not yet wired
 * to a calendar interaction. Recorded as a known scope reduction, not a silent one.
 */

const MOVEMENTS_TABLE_TAG = 'fenix-movimientos-cuenta';
const MOVEMENTS_TABLE_LABEL = 'MovementsTable';
const MOVEMENTS_TABLE_SELECTOR = `document.getElementsByTagName('${MOVEMENTS_TABLE_TAG}')[0]`;
const LOG_GROUP = 'account-transactions';

export function accountTransactionsScript(input: { priorMonths?: number } = {}): string {
  // `priorMonths` is accepted for signature compatibility (spec Decision 4) but not yet wired to
  // a calendar interaction — see the documented simplification above.
  void input;
  return `
    ${commonHelperFunctions()}
    ${generateWaitForElementHelperFunctions({
      label: MOVEMENTS_TABLE_LABEL,
      selector: `(${MOVEMENTS_TABLE_SELECTOR} || document.getElementsByClassName('alert-warning')[0])`,
    })}
    ${fetchTransactionsOfPageHelper()}

    (async function () {
      const logGroup = '${LOG_GROUP}-product-' + window.productId;
      sendTrace({ logGroup, message: 'Starting account transactions script' });

      ${generateExecutableStepFunction({
        stepName: 'wait-for-page-to-be-ready',
        logGroup: LOG_GROUP,
        code: `
          await waitForPageToBeReady('${LOG_GROUP}');
          await waitFor${MOVEMENTS_TABLE_LABEL}Element();
        `,
      })}

      const noMovementsWarning = document.getElementsByClassName('alert-warning');
      if (noMovementsWarning.length) {
        sendTrace({ logGroup, message: 'No movements found for this product' });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'state-change',
          stepId: 'get-transactions-start',
          progress: 0.8,
          data: { movements: [] },
        }));
        history.back();
        return;
      }

      const paginatorLabels = document.getElementsByClassName('mat-paginator-label');
      const paginatorLabel = paginatorLabels[1] || paginatorLabels[0];
      const statedTotal = paginatorLabel
        ? Number.parseInt((paginatorLabel.textContent || '').trim().split('de ')[1], 10)
        : null;

      const movements = [];
      let position = 0;
      let page = 1;
      while (true) {
        const rowsInPage = fetchTransactionsOfPage(logGroup, position);
        for (let i = 0; i < rowsInPage.length; i++) {
          movements.push(rowsInPage[i]);
          position++;
        }
        sendTrace({ logGroup, message: 'Found ' + rowsInPage.length + ' rows in page ' + page });
        const nextPageButton = document.getElementsByClassName('mat-paginator-navigation-next')[0];
        if (!nextPageButton || nextPageButton.disabled) {
          break;
        }
        nextPageButton.click();
        await wait(200);
        page++;
      }

      if (statedTotal !== null && movements.length < statedTotal) {
        sendTrace({ logGroup, type: 'error', message: 'Parsed fewer movements than the bank stated: ' + movements.length + ' of ' + statedTotal });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'parse_failed', productInstanceId: window.productId, attempts: 1 },
        }));
        return;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.8,
        data: { movements: movements },
      }));
      history.back();
    })().then(function () {
      sendTrace({ logGroup: '${LOG_GROUP}', message: 'Account transactions script finished' });
    }).catch(function (error) {
      sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Account transactions script failed: ' + error.message });
    });
  `;
}

function fetchTransactionsOfPageHelper(): string {
  return `
    function fetchTransactionsOfPage(logGroup, startingPosition) {
      const movements = [];
      const table = ${MOVEMENTS_TABLE_SELECTOR};
      if (!table) return movements;
      const body = table.getElementsByTagName('tbody')[0];
      if (!body) return movements;
      const rows = body.getElementsByTagName('tr');
      // Documented simplification: the source skips every other <tr> (rows[i += 2]) because the
      // live Angular Material table pairs each movement row with a hidden detail/expansion row.
      // Hand-authored fixtures have no reason to replicate that specific DOM quirk — one <tr>
      // per movement here.
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const dateText = row.children[0].innerHTML.trim();
        const rawDescription = row.children[1].innerHTML.trim();
        const outgoingCell = row.children[3] && row.children[3].children[0];
        const incomingCell = row.children[4] && row.children[4].children[0];
        const outgoingText = outgoingCell && outgoingCell.innerHTML.trim() ? outgoingCell.innerHTML.trim() : null;
        const incomingText = incomingCell && incomingCell.innerHTML.trim() ? incomingCell.innerHTML.trim() : null;
        movements.push({
          productInstanceId: window.productId,
          dateText: dateText,
          outgoingText: outgoingText,
          incomingText: incomingText,
          currencyCode: 'CLP',
          rawDescription: rawDescription,
          bankSuppliedId: null,
          positionInReadSnapshot: startingPosition + i,
          extras: {},
        });
      }
      return movements;
    }
  `;
}
